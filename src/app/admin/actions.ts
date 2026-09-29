"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { business } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LEAD_STAGES, SlotTakenError, type LeadStage } from "@/lib/leads/types";
import { getEmailAdapter } from "@/lib/email";
import { retryFailedNotifications } from "@/lib/notifications";
import { composeOwnerEmail } from "@/lib/owner-email";
import { getPaymentAdapter } from "@/lib/payments";
import { deleteLeadPhotos } from "@/lib/photos";
import { addDays, easternToUtc, isIsoDate, overlapsWithBuffer, todayEastern, withinWorkHours } from "@/lib/time";
import { cleanText } from "@/lib/utils";

/**
 * Every action re-checks authorization on the server. Errors are passed back
 * through the query string so the page stays a plain server component.
 */

function back(leadId: string, msg?: { ok?: string; error?: string }) {
  const q = new URLSearchParams();
  if (msg?.ok) q.set("ok", msg.ok);
  if (msg?.error) q.set("error", msg.error);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
  redirect(`/admin/leads/${leadId}${q.size ? `?${q}` : ""}`);
}

async function store() {
  const s = await getLeadStore();
  if (!s) throw new Error("Lead store unavailable.");
  return s;
}

export async function updateLeadAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const followUp = String(formData.get("followUpOn") ?? "").trim();
  const notes = cleanText(formData.get("internalNotes"), 5000);
  if (!(LEAD_STAGES as readonly string[]).includes(stage)) return back(id, { error: "Invalid stage." });
  if (followUp && !isIsoDate(followUp)) return back(id, { error: "Follow-up date is invalid." });
  const s = await store();
  await s.updateLead(id, { stage: stage as LeadStage, followUpOn: followUp || null, internalNotes: notes || null });
  return back(id, { ok: "Saved." });
}

export async function archiveLeadAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const unarchive = formData.get("unarchive") === "1";
  const s = await store();
  await s.updateLead(id, { archivedAt: unarchive ? null : new Date().toISOString() });
  return back(id, { ok: unarchive ? "Restored." : "Archived." });
}

export async function deleteLeadAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  if (String(formData.get("confirm") ?? "") !== "DELETE") return back(id, { error: "Type DELETE to confirm." });
  const s = await store();
  const lead = await s.getLead(id);
  if (!lead) redirect("/admin");
  await deleteLeadPhotos(lead.photoRefs).catch(() => undefined);
  await s.deleteLead(id);
  revalidatePath("/admin");
  redirect("/admin?ok=Lead+deleted");
}

export async function retryNotificationsAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const s = await store();
  const n = await retryFailedNotifications(s, id);
  return back(id, { ok: `Retried ${n} notification(s).` });
}

export async function confirmAppointmentAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  if (business.mode !== "LIVE") {
    return back(id, { error: "Appointments cannot be confirmed in PRELAUNCH mode. Switch NEXT_PUBLIC_BUSINESS_MODE to LIVE first." });
  }
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const duration = Number(formData.get("durationMinutes") ?? business.scheduling.defaultDurationMinutes);
  const price = Number(formData.get("quotedPrice") ?? "");
  const agreed = formData.get("customerAgreed") === "on";
  const notes = cleanText(formData.get("notes"), 1000) || null;
  const override = formData.get("overrideConflicts") === "on";

  if (!isIsoDate(date) || !/^\d{2}:\d{2}$/.test(time)) return back(id, { error: "Enter a valid date and time." });
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) return back(id, { error: "Duration must be 15 to 600 minutes." });
  if (!Number.isFinite(price) || price < 0) return back(id, { error: "Enter the quoted price." });
  if (!agreed) return back(id, { error: "Confirm that the customer agreed to this time and price." });

  const start = easternToUtc(date, time);
  const end = new Date(start.getTime() + duration * 60_000);
  if (start.getTime() < Date.now()) return back(id, { error: "That time is in the past." });

  const hours = withinWorkHours(start, end);
  if (!hours.ok && !override) return back(id, { error: `${hours.reason} Tick “override” to schedule anyway.` });

  const s = await store();
  const dayOff = (await s.listTimeOff({ from: date })).find((t) => t.day === date);
  if (dayOff && !override) {
    return back(id, { error: "That date is marked as a day off. Remove it under Days off, or tick “override” to schedule anyway." });
  }
  const existing = await s.listAppointments({
    from: new Date(start.getTime() - 24 * 3600_000).toISOString(),
    to: new Date(end.getTime() + 24 * 3600_000).toISOString(),
  });
  const conflict = existing.find(
    (a) =>
      a.status === "confirmed" &&
      overlapsWithBuffer(
        { start: new Date(a.startsAt), end: new Date(a.endsAt) },
        { start, end },
        business.scheduling.travelBufferMinutes,
      ),
  );
  if (conflict && !override) {
    return back(id, {
      error: `Overlaps a confirmed appointment (including ${business.scheduling.travelBufferMinutes} min travel buffer). Tick “override” to schedule anyway.`,
    });
  }

  try {
    await s.createAppointment({
      leadId: id,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status: "confirmed",
      quotedPriceCents: Math.round(price * 100),
      customerAgreed: true,
      completedRevenueCents: null,
      notes,
      source: "owner",
      serviceId: (await s.getLead(id))?.serviceId ?? null,
      depositCents: null,
      depositStatus: "none",
      checkoutSessionId: null,
      paymentIntentId: null,
      holdExpiresAt: null,
      bufferMinutes: business.scheduling.travelBufferMinutes,
    });
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return back(id, {
        error: `That time overlaps another booked or held appointment (including the ${business.scheduling.travelBufferMinutes} min travel buffer). The calendar can't double-book.`,
      });
    }
    throw err;
  }
  await s.updateLead(id, { stage: "scheduled" });
  revalidatePath("/admin/appointments");
  return back(id, { ok: "Appointment confirmed." });
}

export async function completeAppointmentAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const apptId = String(formData.get("appointmentId") ?? "");
  const revenue = Number(formData.get("revenue") ?? "");
  if (!Number.isFinite(revenue) || revenue < 0) return back(id, { error: "Enter the amount actually collected." });
  const s = await store();
  await s.updateAppointment(apptId, { status: "completed", completedRevenueCents: Math.round(revenue * 100) });
  await s.updateLead(id, { stage: "completed" });
  revalidatePath("/admin/appointments");
  return back(id, { ok: "Job marked completed and revenue recorded." });
}

export async function cancelAppointmentAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const apptId = String(formData.get("appointmentId") ?? "");
  const deposit = String(formData.get("deposit") ?? "");
  const s = await store();
  const appt = (await s.listAppointments({ leadId: id })).find((a) => a.id === apptId);
  if (!appt) return back(id, { error: "Appointment not found." });

  if (appt.depositStatus === "paid") {
    if (deposit === "refund") {
      if (!appt.paymentIntentId || !appt.depositCents) return back(id, { error: "No payment on record to refund." });
      try {
        await getPaymentAdapter().refund(appt.paymentIntentId, appt.depositCents);
      } catch (err) {
        return back(id, { error: `Refund failed, appointment not cancelled: ${err instanceof Error ? err.message : "unknown error"}` });
      }
      await s.updateAppointment(apptId, { status: "cancelled", depositStatus: "refunded" });
      revalidatePath("/admin/appointments");
      return back(id, { ok: "Appointment cancelled and deposit refunded." });
    }
    if (deposit === "keep") {
      await s.updateAppointment(apptId, { status: "cancelled", depositStatus: "forfeited" });
      revalidatePath("/admin/appointments");
      return back(id, { ok: "Appointment cancelled. Deposit kept per the cancellation policy." });
    }
    return back(id, { error: "Choose whether to refund or keep the deposit." });
  }

  await s.updateAppointment(apptId, { status: "cancelled" });
  revalidatePath("/admin/appointments");
  return back(id, { ok: "Appointment cancelled." });
}

function backToTimeOff(msg: { ok?: string; error?: string }) {
  const q = new URLSearchParams(msg.ok ? { ok: msg.ok } : { error: msg.error ?? "" });
  revalidatePath("/admin/time-off");
  redirect(`/admin/time-off?${q}`);
}

const MAX_TIME_OFF_DAYS = 120;

/** Block one day, or every working day in a from-to range. */
export async function addTimeOffAction(formData: FormData) {
  await requireOwner();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "").trim() || from;
  const note = cleanText(formData.get("note"), 200) || null;
  if (!isIsoDate(from) || !isIsoDate(to)) return backToTimeOff({ error: "Pick a valid date." });
  if (from < todayEastern()) return backToTimeOff({ error: "That date has already passed." });
  if (to < from) return backToTimeOff({ error: "The end date is before the start date." });

  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (days.length >= MAX_TIME_OFF_DAYS) return backToTimeOff({ error: `Block at most ${MAX_TIME_OFF_DAYS} days at a time.` });
    const [y, m, dd] = d.split("-").map(Number);
    // Only working days need blocking; the calendar is already closed the rest.
    if ((business.scheduling.workDays as readonly number[]).includes(new Date(Date.UTC(y, m - 1, dd)).getUTCDay())) days.push(d);
  }
  if (days.length === 0) return backToTimeOff({ error: "You don't work that day anyway, so there's nothing to block." });

  const s = await store();
  await s.addTimeOff(days, note);
  return backToTimeOff({ ok: days.length === 1 ? "Day off added." : `${days.length} days off added.` });
}

export async function removeTimeOffAction(formData: FormData) {
  await requireOwner();
  const day = String(formData.get("day") ?? "");
  if (!isIsoDate(day)) return backToTimeOff({ error: "Invalid date." });
  const s = await store();
  await s.removeTimeOff(day);
  return backToTimeOff({ ok: "Day reopened for booking." });
}
export interface SendEmailState {
  status: "idle" | "sent" | "error";
  message: string | null;
  /** Key for the next send; a fresh one after every attempt. */
  sendKey: string;
}

/**
 * Email a lead from the dashboard through Resend, from the business address.
 * Replies go to the contact inbox. Returns state (rather than redirecting) so
 * a failed send keeps the draft on screen.
 */
export async function sendLeadEmailAction(_prev: SendEmailState, formData: FormData): Promise<SendEmailState> {
  await requireOwner();
  const next = (status: SendEmailState["status"], message: string): SendEmailState => ({ status, message, sendKey: randomUUID() });
  const leadId = String(formData.get("leadId") ?? "");
  const sendKey = String(formData.get("sendKey") ?? "");
  const subject = cleanText(formData.get("subject"), 200).replace(/\s+/g, " ");
  const message = cleanText(formData.get("message"), 8000);
  if (!/^[0-9a-f-]{36}$/.test(sendKey)) return next("error", "Please reload the page and try again.");
  if (!subject) return next("error", "Add a subject.");
  if (!message) return next("error", "Write a message first.");

  const s = await store();
  const lead = await s.getLead(leadId);
  if (!lead) return next("error", "Lead not found.");
  if (await s.findOutboundEmailBySendKey(sendKey)) return next("sent", "Already sent.");

  const email = getEmailAdapter();
  if (email.kind === "disabled") return next("error", "Email isn't configured on the server (Resend).");

  const body = composeOwnerEmail(message);
  const base = { leadId, sendKey, toEmail: lead.email, subject, body, providerMessageId: null, error: null };
  try {
    const { id } = await email.send({
      to: lead.email,
      subject,
      text: body,
      replyTo: business.contact.email ?? undefined,
      idempotencyKey: `owner-email-${sendKey}`,
    });
    await s.recordOutboundEmail({ ...base, status: "sent", providerMessageId: id });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
    await s.recordOutboundEmail({ ...base, status: "failed", error: reason }).catch(() => null);
    revalidatePath(`/admin/leads/${leadId}`);
    return next("error", `Not sent: ${reason}`);
  }
  if (lead.stage === "new") await s.updateLead(leadId, { stage: "contacted" });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
  return next("sent", `Sent to ${lead.email}.`);
}