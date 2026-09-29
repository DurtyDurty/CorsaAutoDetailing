"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { business } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LEAD_STAGES, SlotTakenError, type LeadStage } from "@/lib/leads/types";
import { retryFailedNotifications } from "@/lib/notifications";
import { getPaymentAdapter } from "@/lib/payments";
import { deleteLeadPhotos } from "@/lib/photos";
import { easternToUtc, isIsoDate, overlapsWithBuffer, withinWorkHours } from "@/lib/time";
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
