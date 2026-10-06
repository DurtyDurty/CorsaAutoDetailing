import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { business, getService } from "@/config/business";
import type { QuoteDraft, QuoteSummary, QuoteViewStatus, SendQuoteInput, SendQuoteResponse } from "@shared/api";
import { formatCents } from "@shared/money";
import { ApiError } from "@/lib/api/http";
import { getEmailAdapter } from "@/lib/email";
import { QuoteConflictError, SlotTakenError, type AppointmentRecord, type LeadRecord, type LeadStore, type QuoteRecord } from "@/lib/leads/types";
import { formatEastern } from "@/lib/time";
import { appointmentConfirmationEmail, sendOwnerEmail } from "@/lib/owner/email";
import { renderQuotePdf, type QuoteDocument } from "./pdf";

/**
 * Quotes: the owner prices a requested time (package plus extras, discount,
 * note), the customer gets it by email with a PDF and a private link, and
 * accepting it confirms the booking.
 *
 * The link token is 256 random bits. Only its sha256 is stored, so a database
 * read can't be turned into a working link. While a quote is open, the
 * requested time stays held until the quote expires.
 */

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NUMBER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isQuoteToken = (token: string) => TOKEN.test(token);

export function quoteUrl(token: string): string {
  return `${business.brand.canonicalDomain.replace(/\/$/, "")}/quote/${token}`;
}

export function effectiveStatus(q: QuoteRecord, now = Date.now()): QuoteViewStatus {
  return q.status === "sent" && Date.parse(q.expiresAt) <= now ? "expired" : q.status;
}

export function toQuoteSummary(q: QuoteRecord): QuoteSummary {
  return {
    id: q.id,
    number: q.number,
    status: effectiveStatus(q),
    lines: q.lines,
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    totalCents: q.totalCents,
    notes: q.notes,
    sentAt: q.createdAt,
    expiresAt: q.expiresAt,
    respondedAt: q.respondedAt,
    responseNote: q.responseNote,
  };
}

const serviceName = (a: AppointmentRecord, lead: LeadRecord | null) =>
  (a.serviceId && getService(a.serviceId)?.name) || lead?.estimate?.serviceName || "Detail";

/** A website request still waiting on the owner: the only kind of job a quote is for. */
export const isQuotable = (a: AppointmentRecord) => a.status === "held" && a.depositStatus === "none" && Date.parse(a.startsAt) > Date.now();

export function quoteDraft(a: AppointmentRecord, lead: LeadRecord | null): QuoteDraft {
  const service = a.serviceId ? getService(a.serviceId) : undefined;
  const base = a.quotedPriceCents > 0 ? a.quotedPriceCents : service ? Math.round(service.price * 100) : 0;
  const lines = [{ label: serviceName(a, lead), amountCents: base }];
  for (const add of lead?.estimate?.addOns ?? []) lines.push({ label: add.label, amountCents: Math.round(add.amount * 100) });
  return {
    lines,
    discountCents: a.discountCents,
    extras: business.additionalServices.map((s) => ({ label: s.name, minCents: s.priceMin * 100, maxCents: s.priceMax * 100 })),
    defaultExpiresInDays: 3,
    latestExpiry: a.startsAt,
  };
}

function quoteNumber(): string {
  let s = "Q-";
  for (let i = 0; i < 6; i++) s += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  return s;
}

function addressOf(lead: LeadRecord | null): string | null {
  return lead ? [lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ") || null : null;
}

export function quoteDocument(q: QuoteRecord, a: AppointmentRecord, lead: LeadRecord | null, acceptUrl: string | null): QuoteDocument {
  return {
    number: q.number,
    issuedAt: q.createdAt,
    expiresAt: q.expiresAt,
    customer: {
      name: lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "Customer",
      email: lead?.email ?? "",
      phone: lead?.phone ?? null,
      address: addressOf(lead),
    },
    appointment: {
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      serviceName: serviceName(a, lead),
      vehicle: lead ? [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") || null : null,
    },
    lines: q.lines,
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    totalCents: q.totalCents,
    notes: q.notes,
    acceptUrl,
  };
}

export const pdfFilename = (q: Pick<QuoteRecord, "number">) => `Corsa-Quote-${q.number}.pdf`;

/** Withdraw any open quote for this appointment (the time changed, or the owner decided without it). */
export async function withdrawOpenQuotes(store: LeadStore, appointmentId: string, note: string): Promise<void> {
  for (const q of await store.listQuotesForAppointments([appointmentId])) {
    if (q.status === "sent") await store.updateQuoteIfStatus(q.id, "sent", { status: "withdrawn", responseNote: note.slice(0, 500) });
  }
}

const day = (iso: string) => formatEastern(iso, { dateStyle: "full", timeStyle: undefined });
const time = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: "short" });

/**
 * Price a website request and email the customer the quote (PDF attached, plus
 * the private link to accept or decline). Sending again replaces the open
 * quote. Safe to retry with the same requestId.
 */
export async function sendQuote(
  store: LeadStore,
  actor: string,
  appointmentId: string,
  input: SendQuoteInput,
  detail: (store: LeadStore, id: string) => Promise<SendQuoteResponse["appointment"]>,
): Promise<SendQuoteResponse> {
  const replay = await store.findQuoteByRequestId(input.requestId);
  if (replay) {
    return { appointment: await detail(store, appointmentId), quote: toQuoteSummary(replay), customerEmail: { status: "skipped", error: null }, unchanged: true };
  }

  const appt = await store.getAppointment(appointmentId);
  if (!appt) throw new ApiError("not_found", "That appointment doesn't exist.");
  if (!isQuotable(appt)) throw new ApiError("conflict", "Quotes are for website requests still waiting on you, before their start time.");
  const lead = await store.getLead(appt.leadId);
  if (!lead) throw new ApiError("not_found", "That customer doesn't exist.");

  const subtotalCents = input.lines.reduce((s, l) => s + l.amountCents, 0);
  const expiresAt = new Date(Math.min(Date.now() + input.expiresInDays * 86_400_000, Date.parse(appt.startsAt))).toISOString();

  await withdrawOpenQuotes(store, appt.id, "Replaced by a newer quote");
  const token = randomBytes(32).toString("base64url");
  let quote: QuoteRecord | null;
  try {
    quote = await store.createQuote({
      appointmentId: appt.id,
      leadId: lead.id,
      number: quoteNumber(),
      tokenHash: hashToken(token),
      lines: input.lines,
      subtotalCents,
      discountCents: input.discountCents,
      totalCents: subtotalCents - input.discountCents,
      notes: input.notes || null,
      expiresAt,
      createdBy: actor,
      requestId: input.requestId,
    });
  } catch (err) {
    if (err instanceof QuoteConflictError) throw new ApiError("conflict", "Another quote for this job was just sent. Pull to refresh.");
    throw err;
  }
  if (!quote) return sendQuote(store, actor, appointmentId, input, detail);

  // Keep the time held for as long as the customer has to decide.
  await store.updateAppointmentIfStatus(appt.id, "held", { holdExpiresAt: expiresAt });
  if (lead.stage === "new" || lead.stage === "contacted") await store.updateLead(lead.id, { stage: "quote_sent" });

  const pdf = await renderQuotePdf(quoteDocument(quote, appt, lead, quoteUrl(token)));
  const name = serviceName(appt, lead);
  const message = [
    `Hi ${lead.firstName},`,
    "",
    `Here's your quote for ${name} on ${day(appt.startsAt)} at ${time(appt.startsAt)}.`,
    "",
    `Total: ${formatCents(quote.totalCents)}`,
    "",
    `Review and accept it here to confirm your appointment:`,
    quoteUrl(token),
    "",
    `The quote is valid until ${formatEastern(expiresAt, { dateStyle: "long", timeStyle: "short" })}, and we're holding your time until then. The PDF is attached for your records.`,
  ].join("\n");
  const sent = await sendOwnerEmail(store, lead.id, {
    subject: `Your quote from ${business.brand.name}: ${name}`,
    message,
    sendKey: `quote-${quote.id}`,
    attachments: [{ filename: pdfFilename(quote), content: pdf }],
    // The link is the customer's key: the copy kept in the email log doesn't carry it.
    loggedMessage: message.replace(quoteUrl(token), "[private quote link]"),
  });
  const customerEmail =
    sent.status === "sent"
      ? { status: "sent" as const, error: null }
      : { status: "failed" as const, error: sent.status === "not_found" ? "Customer not found." : sent.reason };

  await store.addAppointmentEvent({
    appointmentId: appt.id,
    type: "note",
    fromStatus: null,
    toStatus: null,
    note:
      customerEmail.status === "sent"
        ? `Quote ${quote.number} sent: ${formatCents(quote.totalCents)}, valid until ${formatEastern(expiresAt)}`
        : `Quote ${quote.number} created, but the email failed: ${customerEmail.error}`,
    actor,
    requestId: input.requestId,
  });

  return { appointment: await detail(store, appt.id), quote: toQuoteSummary(quote), customerEmail, unchanged: false };
}

/* ---------- The customer's side ---------- */

export interface QuoteForCustomer {
  quote: QuoteRecord;
  status: QuoteViewStatus;
  appointment: AppointmentRecord;
  lead: LeadRecord | null;
}

export async function loadQuoteByToken(store: LeadStore, token: string): Promise<QuoteForCustomer | null> {
  if (!isQuoteToken(token)) return null;
  const quote = await store.getQuoteByTokenHash(hashToken(token));
  if (!quote) return null;
  const appointment = await store.getAppointment(quote.appointmentId);
  if (!appointment) return null;
  return { quote, status: effectiveStatus(quote), appointment, lead: await store.getLead(quote.leadId) };
}

export type QuoteResponse = { ok: true } | { ok: false; message: string };

const UNAVAILABLE: Record<Exclude<QuoteViewStatus, "sent">, string> = {
  accepted: "This quote was already accepted. Your appointment is confirmed.",
  declined: "This quote was declined. Reply to our email if you'd like a new one.",
  withdrawn: "This quote was replaced by a newer one. Check your email for the latest.",
  expired: "This quote has expired. Reply to our email or request a new time and we'll send a fresh quote.",
};

async function tellOwner(subject: string, lines: string[], key: string) {
  const to = process.env.OWNER_NOTIFY_EMAIL;
  const email = getEmailAdapter();
  if (!to || email.kind === "disabled") return;
  await email
    .send({ to, subject: `[${business.brand.shortName}] ${subject}`, text: lines.join("\n"), idempotencyKey: key })
    .catch((err) => console.error("[quotes] owner alert failed:", err instanceof Error ? err.message : err));
}

/** The customer accepts: the quote's price is agreed and the requested time becomes a confirmed job. */
export async function acceptQuote(store: LeadStore, token: string): Promise<QuoteResponse> {
  const found = await loadQuoteByToken(store, token);
  if (!found) return { ok: false, message: "We couldn't find that quote." };
  const { quote, appointment: a, lead } = found;
  if (found.status !== "sent") return { ok: false, message: UNAVAILABLE[found.status] };

  const now = new Date().toISOString();
  const won = await store.updateQuoteIfStatus(quote.id, "sent", { status: "accepted", respondedAt: now });
  if (!won) {
    const latest = await store.getQuoteByTokenHash(quote.tokenHash);
    const s = latest ? effectiveStatus(latest) : "withdrawn";
    return s === "accepted" ? { ok: true } : { ok: false, message: UNAVAILABLE[s === "sent" ? "withdrawn" : s] };
  }

  let confirmed: AppointmentRecord | null = null;
  try {
    confirmed = await store.updateAppointmentIfStatus(a.id, "held", {
      status: "confirmed",
      holdExpiresAt: null,
      quotedPriceCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      customerAgreed: true,
    });
  } catch (err) {
    if (!(err instanceof SlotTakenError)) throw err;
  }
  if (!confirmed) {
    // The time was released or changed in the meantime: undo the acceptance and say so.
    await store.updateQuoteIfStatus(quote.id, "accepted", { status: "withdrawn", responseNote: "Time no longer held when accepted" });
    return { ok: false, message: "Sorry, that time is no longer being held. Reply to our email and we'll find another time." };
  }

  await store.addAppointmentEvent({
    appointmentId: a.id,
    type: "status",
    fromStatus: "held",
    toStatus: "confirmed",
    note: `Customer accepted quote ${quote.number} (${formatCents(quote.totalCents)})`,
    actor: "customer",
    requestId: null,
  });
  await store.updateLead(a.leadId, { stage: "scheduled" });

  if (lead) {
    const address = addressOf(lead);
    const email = appointmentConfirmationEmail({
      firstName: lead.firstName,
      serviceName: serviceName(a, lead),
      startsAt: a.startsAt,
      address,
      priceCents: quote.totalCents,
    });
    // Same key as confirming from the app, so the customer gets one confirmation either way.
    await sendOwnerEmail(store, lead.id, { ...email, sendKey: `confirmed-${a.id}` }).catch(() => null);
  }
  await tellOwner(
    `Quote accepted: ${lead?.firstName ?? "Customer"}, ${formatEastern(a.startsAt, { dateStyle: "medium", timeStyle: "short" })}`,
    [
      `${lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "The customer"} accepted quote ${quote.number} for ${formatCents(quote.totalCents)}.`,
      `The job on ${day(a.startsAt)} at ${time(a.startsAt)} is now confirmed, and they've been emailed a confirmation.`,
      "",
      `Open it in the Corsa Owner app or at ${business.brand.canonicalDomain.replace(/\/$/, "")}/admin/jobs/${a.id}`,
    ],
    `quote-accepted-${quote.id}`,
  );
  return { ok: true };
}

/** The customer declines: the time is released and the owner is told why. */
export async function declineQuote(store: LeadStore, token: string, reason: string | null): Promise<QuoteResponse> {
  const found = await loadQuoteByToken(store, token);
  if (!found) return { ok: false, message: "We couldn't find that quote." };
  const { quote, appointment: a, lead } = found;
  if (found.status !== "sent") return { ok: false, message: UNAVAILABLE[found.status] };

  const note = reason?.replace(/\s+/g, " ").trim().slice(0, 500) || null;
  const won = await store.updateQuoteIfStatus(quote.id, "sent", { status: "declined", respondedAt: new Date().toISOString(), responseNote: note });
  if (!won) return { ok: false, message: "This quote was just updated. Refresh the page to see where it stands." };

  const released = await store.updateAppointmentIfStatus(a.id, "held", {
    status: "declined",
    depositStatus: "released",
    holdExpiresAt: null,
    cancelReason: "Customer declined the quote",
  });
  if (released) {
    await store.addAppointmentEvent({
      appointmentId: a.id,
      type: "status",
      fromStatus: "held",
      toStatus: "declined",
      note: `Customer declined quote ${quote.number}${note ? `: ${note}` : ""}`,
      actor: "customer",
      requestId: null,
    });
  }
  await tellOwner(
    `Quote declined: ${lead?.firstName ?? "Customer"}`,
    [
      `${lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "The customer"} declined quote ${quote.number} (${formatCents(quote.totalCents)}).`,
      note ? `Their reason: ${note}` : "They didn't give a reason.",
      `The time they requested (${day(a.startsAt)} at ${time(a.startsAt)}) is open again.`,
      lead ? `Reply to them at ${lead.email}${lead.phone ? ` or ${lead.phone}` : ""}.` : "",
    ],
    `quote-declined-${quote.id}`,
  );
  return { ok: true };
}
