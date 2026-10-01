"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { business } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { logAppointmentEvent } from "@/lib/owner/appointments";
import { sendOwnerEmail } from "@/lib/owner/email";
import { scheduleAppointment } from "@/lib/owner/schedule";
import { ApiError } from "@/lib/api/http";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads/types";
import { retryFailedNotifications } from "@/lib/notifications";
import { getPaymentAdapter } from "@/lib/payments";
import { deleteLeadPhotos } from "@/lib/photos";
import { addDays, isIsoDate, todayEastern } from "@/lib/time";
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
  const owner = await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const duration = Number(formData.get("durationMinutes") ?? business.scheduling.defaultDurationMinutes);
  const price = Number(formData.get("quotedPrice") ?? "");
  const agreed = formData.get("customerAgreed") === "on";
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) return back(id, { error: "Duration must be 15 to 600 minutes." });
  if (!Number.isFinite(price) || price < 0) return back(id, { error: "Enter the quoted price." });
  if (!agreed) return back(id, { error: "Confirm that the customer agreed to this time and price." });

  const s = await store();
  try {
    // Same checks as booking from the app: hours, days off, travel buffer, no overlaps.
    await scheduleAppointment(s, {
      leadId: id,
      date: String(formData.get("date") ?? ""),
      time: String(formData.get("time") ?? ""),
      durationMinutes: duration,
      priceCents: Math.round(price * 100),
      serviceId: (await s.getLead(id))?.serviceId ?? null,
      notes: cleanText(formData.get("notes"), 1000) || null,
      override: formData.get("overrideConflicts") === "on",
      actor: owner.email,
      requestId: null,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      const message = err.fields?.override ? err.message.replace(/ Book anyway\?$/, " Tick “override” to schedule anyway.") : err.message;
      return back(id, { error: message });
    }
    throw err;
  }
  revalidatePath("/admin/appointments");
  return back(id, { ok: "Appointment confirmed." });
}
export async function completeAppointmentAction(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("leadId") ?? "");
  const apptId = String(formData.get("appointmentId") ?? "");
  const revenue = Number(formData.get("revenue") ?? "");
  if (!Number.isFinite(revenue) || revenue < 0) return back(id, { error: "Enter the amount actually collected." });
  const s = await store();
  const before = await s.getAppointment(apptId);
  await s.updateAppointment(apptId, { status: "completed", completedRevenueCents: Math.round(revenue * 100) });
  if (before && before.status !== "completed") {
    await logAppointmentEvent(s, { appointmentId: apptId, type: "status", from: before.status, to: "completed", note: `Collected ${(revenue).toFixed(2)} (dashboard)`, actor: owner.email });
  }
  await s.updateLead(id, { stage: "completed" });
  revalidatePath("/admin/appointments");
  return back(id, { ok: "Job marked completed and revenue recorded." });
}

export async function cancelAppointmentAction(formData: FormData) {
  const owner = await requireOwner();
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
      await s.updateAppointment(apptId, { status: "cancelled", depositStatus: "refunded", cancelledBy: "owner" });
      await logAppointmentEvent(s, { appointmentId: apptId, type: "status", from: appt.status, to: "cancelled", note: "Deposit refunded (dashboard)", actor: owner.email });
      revalidatePath("/admin/appointments");
      return back(id, { ok: "Appointment cancelled and deposit refunded." });
    }
    if (deposit === "keep") {
      await s.updateAppointment(apptId, { status: "cancelled", depositStatus: "forfeited", cancelledBy: "owner" });
      await logAppointmentEvent(s, { appointmentId: apptId, type: "status", from: appt.status, to: "cancelled", note: "Deposit kept (dashboard)", actor: owner.email });
      revalidatePath("/admin/appointments");
      return back(id, { ok: "Appointment cancelled. Deposit kept per the cancellation policy." });
    }
    return back(id, { error: "Choose whether to refund or keep the deposit." });
  }

  await s.updateAppointment(apptId, { status: "cancelled", cancelledBy: "owner" });
  await logAppointmentEvent(s, { appointmentId: apptId, type: "status", from: appt.status, to: "cancelled", note: "Cancelled from the dashboard", actor: owner.email });
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
  const result = await sendOwnerEmail(s, leadId, { subject, message, sendKey });
  revalidatePath(`/admin/leads/${leadId}`);
  if (result.status === "not_found") return next("error", "Lead not found.");
  if (result.status === "unavailable") return next("error", result.reason);
  if (result.status === "failed") return next("error", `Not sent: ${result.reason}`);
  if (result.alreadySent) return next("sent", "Already sent.");
  revalidatePath("/admin");
  return next("sent", `Sent to ${result.record?.toEmail ?? "the customer"}.`);
}