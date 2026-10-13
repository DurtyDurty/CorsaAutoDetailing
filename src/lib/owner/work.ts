import "server-only";
import { business, getService } from "@/config/business";
import type { ChangeTotalInput, RecordPaymentInput, RescheduleInput, WorkResponse } from "@shared/api";
import { computeBalance, formatCents, PAYMENT_METHOD_LABELS } from "@shared/money";
import { ApiError } from "@/lib/api/http";
import { SlotTakenError, type AppointmentRecord, type LeadStore } from "@/lib/leads/types";
import { formatEastern } from "@/lib/time";
import { getAppointmentDetail, logAppointmentEvent, priceChangeNote, WORK_CONFIRMATION_SENT } from "./appointments";
import { sendOwnerEmail } from "./email";
import { invoiceDocument, invoiceFilename, isInvoiceable, renderInvoice } from "./invoice";
import type { EmailAttachment } from "@/lib/email";
import { assertCanSchedule, overlapMessage } from "./schedule";
import { withdrawOpenQuotes } from "@/lib/quotes/service";

/**
 * Working a job from the app: move it, record what was paid, send a receipt,
 * keep private notes. Each is safe to retry with the same requestId.
 */

type CustomerEmail = WorkResponse["customerEmail"];
const SKIPPED: CustomerEmail = { status: "skipped", error: null };

async function requireAppointment(store: LeadStore, id: string): Promise<AppointmentRecord> {
  const appt = await store.getAppointment(id);
  if (!appt) throw new ApiError("not_found", "That appointment doesn't exist.");
  return appt;
}

async function replayed(store: LeadStore, requestId: string, id: string): Promise<WorkResponse | null> {
  const event = await store.findAppointmentEventByRequestId(requestId);
  return event ? { appointment: await getAppointmentDetail(store, id), customerEmail: SKIPPED, unchanged: true } : null;
}

const when = (iso: string) => formatEastern(iso, { dateStyle: "full", timeStyle: "short" });
const serviceName = (a: AppointmentRecord) => (a.serviceId && getService(a.serviceId)?.name) || "detail";

async function emailCustomer(store: LeadStore, leadId: string, subject: string, message: string, sendKey: string, attachments?: EmailAttachment[]): Promise<CustomerEmail> {
  const sent = await sendOwnerEmail(store, leadId, { subject, message, sendKey, attachments });
  if (sent.status === "sent") return { status: "sent", error: null };
  return { status: "failed", error: sent.status === "not_found" ? "Customer not found." : sent.reason };
}

export async function rescheduleAppointment(store: LeadStore, actor: string, id: string, input: RescheduleInput): Promise<WorkResponse> {
  const replay = await replayed(store, input.requestId, id);
  if (replay) return replay;
  const appt = await requireAppointment(store, id);
  if (appt.status !== "confirmed" && appt.status !== "held") {
    throw new ApiError("conflict", "Only an upcoming appointment can be moved.");
  }

  const { start, end } = await assertCanSchedule(store, { ...input, excludeId: id });
  let updated: AppointmentRecord | null;
  try {
    updated = await store.updateAppointmentIfStatus(id, appt.status, { startsAt: start.toISOString(), endsAt: end.toISOString() });
  } catch (err) {
    if (err instanceof SlotTakenError) throw new ApiError("conflict", overlapMessage(business.scheduling.travelBufferMinutes));
    throw err;
  }
  if (!updated) throw new ApiError("conflict", "This appointment was just changed on another device. Pull to refresh and try again.");
  // A quote names the old time: it can't be accepted any more. Send a new one for the new time.
  if (appt.status === "held") await withdrawOpenQuotes(store, id, "Appointment moved");

  await store.addAppointmentEvent({
    appointmentId: id,
    type: "rescheduled",
    fromStatus: null,
    toStatus: null,
    note: `Moved from ${when(appt.startsAt)} to ${when(updated.startsAt)}`,
    actor,
    requestId: input.requestId,
  });

  let customerEmail = SKIPPED;
  if (input.notifyCustomer) {
    const lead = await store.getLead(appt.leadId);
    customerEmail = await emailCustomer(
      store,
      appt.leadId,
      `New time for your ${serviceName(updated)}`,
      [
        `Hi ${lead?.firstName ?? "there"},`,
        "",
        `Your ${serviceName(updated)} is now ${when(updated.startsAt)} (Eastern).`,
        "",
        "If that doesn't work, just reply to this email.",
      ].join("\n"),
      `reschedule-${input.requestId}`,
    );
  }
  return { appointment: await getAppointmentDetail(store, id), customerEmail, unchanged: false };
}

export async function recordPayment(store: LeadStore, actor: string, id: string, input: RecordPaymentInput): Promise<WorkResponse> {
  const appt = await requireAppointment(store, id);
  if (appt.status === "held" || appt.status === "declined") {
    throw new ApiError("conflict", "Confirm the booking before recording a payment.");
  }
  const payments = await store.listPayments({ appointmentIds: [id] });
  if (input.kind === "refund") {
    const collected = computeBalance({
      quotedPriceCents: appt.quotedPriceCents,
      discountCents: appt.discountCents,
      depositCents: appt.depositCents,
      depositStatus: appt.depositStatus,
      completedRevenueCents: appt.completedRevenueCents,
      payments,
    }).collectedCents;
    if (input.amountCents > collected) {
      throw new ApiError("invalid", `You can refund at most ${formatCents(collected)}, the amount collected.`, { amountCents: "More than was collected." });
    }
  }

  const rec = await store.recordPayment({
    appointmentId: id,
    kind: input.kind,
    method: input.method,
    amountCents: input.amountCents,
    note: input.note || null,
    providerRef: null,
    recordedBy: actor,
    requestId: input.requestId,
  });
  if (!rec) return { appointment: await getAppointmentDetail(store, id), customerEmail: SKIPPED, unchanged: true };

  const verb = input.kind === "refund" ? "Refunded" : input.kind === "deposit" ? "Deposit received" : "Payment received";
  await logAppointmentEvent(store, {
    appointmentId: id,
    type: "payment",
    note: `${verb}: ${formatCents(input.amountCents)} by ${PAYMENT_METHOD_LABELS[input.method].toLowerCase()}${input.note ? ` (${input.note})` : ""}`,
    actor,
  });
  return { appointment: await getAppointmentDetail(store, id), customerEmail: SKIPPED, unchanged: false };
}

/**
 * Extra work asked for on the day (or something taken off): changes the total the invoice,
 * balance and work confirmation use. Nothing is sent to the customer.
 */
export async function changeTotal(store: LeadStore, actor: string, id: string, input: ChangeTotalInput): Promise<WorkResponse> {
  const replay = await replayed(store, input.requestId, id);
  if (replay) return replay;
  const appt = await requireAppointment(store, id);
  if (!isInvoiceable(appt)) throw new ApiError("conflict", "The total can be changed once the job is booked. Before that, revise the quote.");

  const patch =
    input.amountCents > 0
      ? { quotedPriceCents: appt.quotedPriceCents + input.amountCents }
      : { discountCents: appt.discountCents - input.amountCents };
  const total = (patch.quotedPriceCents ?? appt.quotedPriceCents) - (patch.discountCents ?? appt.discountCents);
  if (total < 0) {
    const most = formatCents(appt.quotedPriceCents - appt.discountCents);
    throw new ApiError("invalid", `You can take off at most ${most}, the current total.`, { amountCents: "More than the total." });
  }
  if (total > 1_000_000) throw new ApiError("invalid", "That total looks too large.", { amountCents: "Too large." });

  const updated = await store.updateAppointmentIfStatus(id, appt.status, patch);
  if (!updated) throw new ApiError("conflict", "This appointment was just changed on another device. Pull to refresh and try again.");
  await store.addAppointmentEvent({
    appointmentId: id,
    type: "note",
    fromStatus: null,
    toStatus: null,
    note: priceChangeNote(input.label, input.amountCents),
    actor,
    requestId: input.requestId,
  });
  return { appointment: await getAppointmentDetail(store, id), customerEmail: SKIPPED, unchanged: false };
}

/** Emails the customer what the job cost, what they paid and anything still owed. */
export async function sendReceipt(store: LeadStore, actor: string, id: string, requestId: string): Promise<WorkResponse> {
  const replay = await replayed(store, requestId, id);
  if (replay) return replay;
  const appt = await requireAppointment(store, id);
  const detail = await getAppointmentDetail(store, id);
  if (detail.balance.collectedCents === 0) {
    throw new ApiError("conflict", "Record a payment first, then send the receipt.");
  }
  const lines = [
    `Hi ${detail.customer.firstName},`,
    "",
    `Thank you for choosing ${business.brand.name}. Here's your receipt.`,
    "",
    `Service: ${serviceName(appt)}`,
    `Date: ${formatEastern(appt.startsAt, { dateStyle: "full", timeStyle: undefined })}`,
    `Total: ${formatCents(detail.balance.totalCents)}`,
    ...detail.payments.map(
      (p) =>
        `${p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} (${PAYMENT_METHOD_LABELS[p.method]}): ${p.kind === "refund" ? "-" : ""}${formatCents(p.amountCents)}`,
    ),
    detail.balance.balanceDueCents > 0 ? `Balance due: ${formatCents(detail.balance.balanceDueCents)}` : "Paid in full.",
  ];
  const customerEmail = await emailCustomer(store, appt.leadId, `Your ${business.brand.name} receipt`, lines.join("\n"), `receipt-${requestId}`);
  await store.addAppointmentEvent({
    appointmentId: id,
    type: "note",
    fromStatus: null,
    toStatus: null,
    note: customerEmail.status === "sent" ? "Receipt emailed to the customer" : `Receipt email failed: ${customerEmail.error}`,
    actor,
    requestId,
  });
  return { appointment: await getAppointmentDetail(store, id), customerEmail, unchanged: false };
}

/**
 * "Your detail is complete": what was done, what it cost, what was paid and anything
 * still owed, with the Google review link when one is set and the invoice PDF attached
 * (the only place the Zelle details appear). Only for a completed job.
 */
export async function sendWorkConfirmation(store: LeadStore, actor: string, id: string, requestId: string): Promise<WorkResponse> {
  const replay = await replayed(store, requestId, id);
  if (replay) return replay;
  const appt = await requireAppointment(store, id);
  if (appt.status !== "completed") {
    throw new ApiError("conflict", "Mark the job complete first, then send the confirmation.");
  }
  const detail = await getAppointmentDetail(store, id);
  const { balance } = detail;
  const vehicle = [detail.vehicle.year, detail.vehicle.make, detail.vehicle.model].filter(Boolean).join(" ");
  const address = [detail.serviceAddress, detail.city, detail.zip].filter(Boolean).join(", ");
  // The same lines as the attached invoice: what was booked, then anything added on the day.
  const work = invoiceDocument(detail).lines;
  const review = business.reviews.googleUrl;
  const lines = [
    `Hi ${detail.customer.firstName},`,
    "",
    `Your ${serviceName(appt)} is complete. Thank you for choosing ${business.brand.name}.`,
    "",
    "Work completed",
    `Service: ${serviceName(appt)}`,
    ...(work.length > 1 ? work.map((l) => `- ${l.label}: ${formatCents(l.amountCents)}`) : []),
    `Date: ${formatEastern(appt.startsAt, { dateStyle: "full", timeStyle: undefined })}`,
    ...(vehicle ? [`Vehicle: ${vehicle}`] : []),
    ...(address ? [`Location: ${address}`] : []),
    "",
    ...(detail.discountCents > 0 ? [`Discount: -${formatCents(detail.discountCents)}`] : []),
    `Total: ${formatCents(balance.totalCents)}`,
    ...detail.payments.map(
      (p) =>
        `${p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} (${PAYMENT_METHOD_LABELS[p.method]}): ${p.kind === "refund" ? "-" : ""}${formatCents(p.amountCents)}`,
    ),
    balance.balanceDueCents > 0
      ? `Balance due: ${formatCents(balance.balanceDueCents)}. We accept card, cash and digital payments.`
      : "Paid in full.",
    ...(review ? ["", "If you're happy with the result, a quick Google review would mean a lot to a new local business:", review] : []),
    "",
    "Your invoice is attached. If anything doesn't look right, just reply to this email.",
  ];
  const customerEmail = await emailCustomer(store, appt.leadId, `Your ${serviceName(appt)} is complete`, lines.join("\n"), `work-confirmation-${requestId}`, [
    { filename: invoiceFilename(detail), content: await renderInvoice(detail) },
  ]);
  await store.addAppointmentEvent({
    appointmentId: id,
    type: "note",
    fromStatus: null,
    toStatus: null,
    note: customerEmail.status === "sent" ? WORK_CONFIRMATION_SENT : `Work confirmation email failed: ${customerEmail.error}`,
    actor,
    requestId,
  });
  return { appointment: await getAppointmentDetail(store, id), customerEmail, unchanged: false };
}

/** A private note on the job (never sent to the customer). */
export async function addNote(store: LeadStore, actor: string, id: string, requestId: string, note: string): Promise<WorkResponse> {
  await requireAppointment(store, id);
  const added = await store.addAppointmentEvent({ appointmentId: id, type: "note", fromStatus: null, toStatus: null, note, actor, requestId });
  return { appointment: await getAppointmentDetail(store, id), customerEmail: SKIPPED, unchanged: added === null };
}
