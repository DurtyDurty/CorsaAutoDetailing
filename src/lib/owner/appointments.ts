import "server-only";
import { getService, getVehicleCategory } from "@/config/business";
import type {
  AppointmentDetail,
  AppointmentEvent,
  AppointmentSummary,
  ListAppointmentsQuery,
  Page,
  Payment,
  StatusChangeInput,
} from "@shared/api";
import {
  allowedTransitions,
  checkTransition,
  type AppointmentStatus,
} from "@shared/appointment-status";
import { computeBalance } from "@shared/money";
import { ApiError } from "@/lib/api/http";
import { appointmentConfirmationEmail, requestDeclinedEmail, sendOwnerEmail } from "./email";
import { effectiveStatus, isQuotable, quoteDraft, toQuoteSummary, withdrawOpenQuotes } from "@/lib/quotes/service";
import type {
  AppointmentEventRecord,
  AppointmentPatch,
  AppointmentRecord,
  LeadRecord,
  LeadStore,
  PaymentRecord,
  QuoteRecord,
} from "@/lib/leads/types";

/* ---------- Mapping ---------- */

export function toSummary(a: AppointmentRecord, lead: LeadRecord | null, payments: PaymentRecord[], latestQuote: QuoteRecord | null = null): AppointmentSummary {
  const serviceId = a.serviceId ?? lead?.serviceId ?? null;
  return {
    id: a.id,
    leadId: a.leadId,
    status: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    serviceId,
    serviceName: serviceId ? (getService(serviceId)?.name ?? lead?.estimate?.serviceName ?? serviceId) : null,
    customerName: lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "Unknown customer",
    phone: lead?.phone ?? null,
    email: lead?.email ?? "",
    serviceAddress: lead?.serviceAddress ?? null,
    city: lead?.city ?? null,
    zip: lead?.zip ?? null,
    vehicle: {
      year: lead?.vehicleYear ?? null,
      make: lead?.vehicleMake ?? null,
      model: lead?.vehicleModel ?? null,
      sizeLabel: lead?.vehicleCategory ? (getVehicleCategory(lead.vehicleCategory)?.label ?? null) : null,
    },
    quotedPriceCents: a.quotedPriceCents,
    discountCents: a.discountCents,
    depositCents: a.depositCents,
    depositStatus: a.depositStatus,
    balance: computeBalance({
      quotedPriceCents: a.quotedPriceCents,
      discountCents: a.discountCents,
      depositCents: a.depositCents,
      depositStatus: a.depositStatus,
      completedRevenueCents: a.completedRevenueCents,
      payments: payments.map((p) => ({ kind: p.kind, amountCents: p.amountCents })),
    }),
    source: a.source,
    cancelReason: a.cancelReason,
    cancelledBy: a.cancelledBy,
    updatedAt: a.updatedAt,
    quoteStatus: latestQuote ? effectiveStatus(latestQuote) : null,
    requested: a.source === "online" ? a.notes : null,
  };
}

function toEvent(e: AppointmentEventRecord): AppointmentEvent {
  return {
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    note: e.note,
    actor: e.actor,
    createdAt: e.createdAt,
  };
}

function toPayment(p: PaymentRecord): Payment {
  return {
    id: p.id,
    kind: p.kind,
    method: p.method,
    amountCents: p.amountCents,
    note: p.note,
    recordedBy: p.recordedBy,
    createdAt: p.createdAt,
  };
}

/** Summaries for many appointments with one lead query and one payments query. */
export async function summarize(store: LeadStore, appts: AppointmentRecord[]): Promise<AppointmentSummary[]> {
  if (appts.length === 0) return [];
  const [leads, payments, quotes] = await Promise.all([
    store.getLeads(appts.map((a) => a.leadId)),
    store.listPayments({ appointmentIds: appts.map((a) => a.id) }),
    store.listQuotesForAppointments(appts.map((a) => a.id)),
  ]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  // Newest first, so the first one seen per appointment is its latest.
  const latestQuote = new Map<string, QuoteRecord>();
  for (const q of quotes) if (!latestQuote.has(q.appointmentId)) latestQuote.set(q.appointmentId, q);
  return appts.map((a) =>
    toSummary(
      a,
      leadById.get(a.leadId) ?? null,
      payments.filter((p) => p.appointmentId === a.id),
      latestQuote.get(a.id) ?? null,
    ),
  );
}

export async function getAppointmentDetail(store: LeadStore, id: string): Promise<AppointmentDetail> {
  const a = await store.getAppointment(id);
  if (!a) throw new ApiError("not_found", "That appointment doesn't exist.");
  const [lead, events, payments, quotes] = await Promise.all([
    store.getLead(a.leadId),
    store.listAppointmentEvents(a.id),
    store.listPayments({ appointmentIds: [a.id] }),
    store.listQuotesForAppointments([a.id]),
  ]);
  const latest = quotes[0] ?? null;
  return {
    ...toSummary(a, lead, payments, latest),
    customer: {
      firstName: lead?.firstName ?? "Unknown",
      lastName: lead?.lastName ?? null,
      preferredContact: lead?.preferredContact ?? null,
    },
    customerNotes: {
      concerns: lead?.concerns ?? null,
      spaceNotes: lead?.notes ?? null,
      conditionFlags: lead?.conditionFlags ?? [],
      condition: lead?.condition ?? null,
    },
    internalNotes: lead?.internalNotes ?? null,
    appointmentNotes: a.notes,
    bufferMinutes: a.bufferMinutes,
    createdAt: a.createdAt,
    events: events.map(toEvent),
    payments: payments.map(toPayment),
    allowedTransitions: [...allowedTransitions(a.status)],
    quote: latest ? toQuoteSummary(latest) : null,
    quoteDraft: isQuotable(a) ? quoteDraft(a, lead) : null,
  };
}

/* ---------- Listing ---------- */

/** Cursor = `<startsAt>|<id>` of the last item returned. */
function decodeCursor(cursor: string | undefined): { startsAt: string; id: string } | null {
  if (!cursor) return null;
  const [startsAt, id] = cursor.split("|");
  if (!startsAt || !id || Number.isNaN(Date.parse(startsAt))) throw new ApiError("invalid", "That page link has expired.");
  return { startsAt, id };
}

export async function listAppointmentSummaries(store: LeadStore, q: ListAppointmentsQuery): Promise<Page<AppointmentSummary>> {
  const after = decodeCursor(q.cursor);
  const all = await store.listAppointments({ from: q.from, to: q.to });
  const filtered = all
    .filter((a) => !q.status || q.status.includes(a.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .filter((a) => !after || a.startsAt > after.startsAt || (a.startsAt === after.startsAt && a.id > after.id));
  const pageItems = filtered.slice(0, q.limit);
  const last = pageItems.at(-1);
  return {
    items: await summarize(store, pageItems),
    nextCursor: filtered.length > q.limit && last ? `${last.startsAt}|${last.id}` : null,
  };
}

/* ---------- Status changes ---------- */

export interface StatusChangeResult {
  appointment: AppointmentRecord;
  unchanged: boolean;
  /** Set when confirming or declining a website request emailed the customer. */
  customerEmail?: { status: "sent" | "failed"; error: string | null } | null;
}

/**
 * Applies a status change with the shared transition rules, records it in the
 * audit history, and keeps the lead's stage in step. Safe to retry: the same
 * requestId, or asking for the status it already has, changes nothing.
 */
export async function changeAppointmentStatus(
  store: LeadStore,
  actor: string,
  id: string,
  input: StatusChangeInput,
): Promise<StatusChangeResult> {
  const appt = await store.getAppointment(id);
  if (!appt) throw new ApiError("not_found", "That appointment doesn't exist.");

  if (await store.findAppointmentEventByRequestId(input.requestId)) return { appointment: appt, unchanged: true };

  const check = checkTransition(appt.status, input.to);
  if (!check.ok) throw new ApiError("conflict", check.reason);
  if (check.noop) return { appointment: appt, unchanged: true };

  const ending = input.to === "cancelled" || input.to === "declined";
  if (ending && appt.depositStatus === "paid") {
    throw new ApiError(
      "conflict",
      "This customer paid a deposit. Cancel it from the web dashboard, where you choose to refund or keep the deposit.",
    );
  }

  const patch: AppointmentPatch = { status: input.to };
  if (input.to === "cancelled") {
    patch.cancelReason = input.reason ?? null;
    patch.cancelledBy = input.cancelledBy ?? null;
  } else if (input.to === "declined" || input.to === "no_show") {
    patch.cancelReason = input.reason ?? null;
  }
  if (appt.status === "held" && input.to !== "confirmed") {
    // The slot was only reserved; nothing was paid.
    patch.depositStatus = "released";
    patch.holdExpiresAt = null;
  }
  // A website calendar request (no deposit) the owner accepts: it's now a firm booking.
  const acceptingRequest = appt.status === "held" && input.to === "confirmed" && appt.depositStatus === "none";
  // A time the owner held for his own quote isn't a customer's request: withdrawing it emails nobody.
  const decliningRequest = appt.status === "held" && input.to === "declined" && appt.depositStatus === "none" && appt.source === "online";
  if (acceptingRequest) patch.holdExpiresAt = null;

  const updated = await store.updateAppointmentIfStatus(id, appt.status, patch);
  if (!updated) {
    // A duplicate of this same request may have won the race; that's success, not a conflict.
    const current = await store.getAppointment(id);
    if (current?.status === input.to) return { appointment: current, unchanged: true };
    throw new ApiError("conflict", "This appointment was just changed on another device. Pull to refresh and try again.");
  }

  await store.addAppointmentEvent({
    appointmentId: id,
    type: "status",
    fromStatus: appt.status,
    toStatus: input.to,
    note: input.reason ?? null,
    actor,
    requestId: input.requestId,
  });

  // Decided without the quote (or the job ended): an open quote can no longer be accepted.
  if (appt.status === "held") await withdrawOpenQuotes(store, id, `Request ${input.to} by ${actor}`);

  let customerEmail: StatusChangeResult["customerEmail"] = null;
  if (acceptingRequest || decliningRequest) {
    customerEmail = await emailCustomerAboutRequest(store, actor, updated, acceptingRequest ? "confirmed" : "declined");
  }

  if (input.to === "completed") await store.updateLead(appt.leadId, { stage: "completed" });
  if (input.to === "declined") await store.updateLead(appt.leadId, { stage: "lost" });
  if (acceptingRequest) await store.updateLead(appt.leadId, { stage: "scheduled" });

  return { appointment: updated, unchanged: false, customerEmail };
}

/**
 * Tell the customer their website request was confirmed or declined, from the
 * business address. Keyed by appointment, so it's sent at most once.
 */
async function emailCustomerAboutRequest(
  store: LeadStore,
  actor: string,
  appt: AppointmentRecord,
  outcome: "confirmed" | "declined",
): Promise<{ status: "sent" | "failed"; error: string | null }> {
  const lead = await store.getLead(appt.leadId);
  if (!lead) return { status: "failed", error: "Customer not found." };
  const email =
    outcome === "confirmed"
      ? appointmentConfirmationEmail({
          firstName: lead.firstName,
          serviceName: (appt.serviceId && getService(appt.serviceId)?.name) || "detail",
          startsAt: appt.startsAt,
          address: [lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ") || null,
          priceCents: appt.quotedPriceCents,
        })
      : requestDeclinedEmail({ firstName: lead.firstName, startsAt: appt.startsAt });
  const sent = await sendOwnerEmail(store, lead.id, { ...email, sendKey: `${outcome}-${appt.id}` });
  const result =
    sent.status === "sent"
      ? { status: "sent" as const, error: null }
      : { status: "failed" as const, error: sent.status === "not_found" ? "Customer not found." : sent.reason };
  await logAppointmentEvent(store, {
    appointmentId: appt.id,
    type: "note",
    note: result.status === "sent" ? `Customer emailed: request ${outcome}` : `Email to customer failed: ${result.error}`,
    actor,
  });
  return result;
}

/** Audit entry for changes made outside changeAppointmentStatus (dashboard forms, booking flow). */
export async function logAppointmentEvent(
  store: LeadStore,
  e: { appointmentId: string; type: AppointmentEventRecord["type"]; from?: AppointmentStatus | null; to?: AppointmentStatus | null; note?: string | null; actor: string },
): Promise<void> {
  await store.addAppointmentEvent({
    appointmentId: e.appointmentId,
    type: e.type,
    fromStatus: e.from ?? null,
    toStatus: e.to ?? null,
    note: e.note ?? null,
    actor: e.actor,
    requestId: null,
  });
}

