import "server-only";
import { createHash } from "node:crypto";
import { business } from "@/config/business";
import type { BusyWindow } from "@/lib/availability";
import { getLeadStore, storeKind } from "@/lib/leads/store";
import { SlotTakenError, type AppointmentRecord, type LeadRecord, type LeadStore } from "@/lib/leads/types";
import { notifyForLead } from "@/lib/notifications";
import { getPaymentAdapter } from "@/lib/payments";
import { todayEastern } from "@/lib/time";

/** Online booking runs only after launch, with a payment provider and a durable store. */
export function bookingEnabled(): boolean {
  return business.mode === "LIVE" && storeKind() !== "unavailable" && getPaymentAdapter().kind !== "disabled";
}

/** Active appointments (confirmed, or held and not yet expired) as busy windows. */
export async function busyWindows(store: LeadStore, now: Date = new Date()): Promise<BusyWindow[]> {
  const nowIso = now.toISOString();
  const horizon = new Date(now.getTime() + (business.booking.maxDaysAhead + 2) * 86_400_000).toISOString();
  const appts = await store.listAppointments({ from: nowIso, to: horizon });
  return appts
    .filter((a) => a.status === "confirmed" || (a.status === "held" && (!a.holdExpiresAt || a.holdExpiresAt > nowIso)))
    .map((a) => ({ start: a.startsAt, busyUntil: a.busyUntil }));
}

/** Days off that fall inside the booking window. */
export async function daysOff(store: LeadStore, now: Date = new Date()): Promise<string[]> {
  return (await store.listTimeOff({ from: todayEastern(now) })).map((t) => t.day);
}

/** Everything computeAvailability needs from the store. */
export async function calendarState(store: LeadStore, now: Date = new Date()) {
  const [busy, off] = await Promise.all([busyWindows(store, now), daysOff(store, now)]);
  return { busy, daysOff: off };
}

/**
 * Token for the "I backed out of payment" link. Derived from the appointment id
 * and the lead's idempotency key, which only the submitting browser knows, so a
 * stranger can't release someone else's hold by guessing ids.
 */
export function releaseToken(appointmentId: string, lead: Pick<LeadRecord, "idempotencyKey">): string {
  return createHash("sha256").update(`${appointmentId}:${lead.idempotencyKey}`).digest("hex").slice(0, 32);
}

export type ConfirmResult =
  | { state: "confirmed"; appointment: AppointmentRecord; lead: LeadRecord }
  | { state: "pending" | "expired" | "unknown" }
  | { state: "conflict_refunded"; lead: LeadRecord };

/**
 * Confirm the booking behind a paid checkout. Safe to call repeatedly and
 * concurrently (webhook + return page): only the caller that flips the row
 * from `held` to `confirmed` sends the confirmation emails.
 */
export async function confirmBookingFromCheckout(sessionId: string): Promise<ConfirmResult> {
  const store = await getLeadStore();
  if (!store) return { state: "unknown" };
  const appt = await store.findAppointmentByCheckoutSession(sessionId);
  if (!appt) return { state: "unknown" };
  const lead = await store.getLead(appt.leadId);
  if (!lead) return { state: "unknown" };
  if (appt.status === "confirmed" && appt.depositStatus === "paid") return { state: "confirmed", appointment: appt, lead };

  const pay = getPaymentAdapter();
  const checkout = await pay.getCheckout(sessionId);
  if (!checkout) return { state: "unknown" };
  if (!checkout.paid) return { state: checkout.status === "expired" ? "expired" : "pending" };

  if (appt.status === "held") {
    const won = await store.markHeldAppointmentPaid(appt.id, checkout.paymentIntentId);
    if (won) {
      await store.updateLead(lead.id, { stage: "scheduled" });
      await notifyForLead(store, lead);
      return { state: "confirmed", appointment: won, lead };
    }
    // Another caller confirmed it a moment ago.
    const fresh = await store.findAppointmentByCheckoutSession(sessionId);
    return fresh?.status === "confirmed" ? { state: "confirmed", appointment: fresh, lead } : { state: "unknown" };
  }

  // Paid after the hold was released: reinstate if the slot is still free, otherwise refund in full.
  if (appt.status === "cancelled" && appt.depositStatus === "released") {
    try {
      const reinstated = await store.updateAppointment(appt.id, {
        status: "confirmed",
        depositStatus: "paid",
        paymentIntentId: checkout.paymentIntentId,
        holdExpiresAt: null,
      });
      if (reinstated) {
        await store.updateLead(lead.id, { stage: "scheduled" });
        await notifyForLead(store, lead);
        return { state: "confirmed", appointment: reinstated, lead };
      }
    } catch (err) {
      if (!(err instanceof SlotTakenError)) throw err;
      if (checkout.paymentIntentId && appt.depositCents) {
        await pay.refund(checkout.paymentIntentId, appt.depositCents);
      }
      await store.updateAppointment(appt.id, { depositStatus: "refunded", paymentIntentId: checkout.paymentIntentId });
      return { state: "conflict_refunded", lead };
    }
  }
  return { state: "unknown" };
}

/** Release an unpaid hold (customer backed out, or the checkout expired). */
export async function releaseHold(appt: AppointmentRecord): Promise<void> {
  const store = await getLeadStore();
  if (!store || appt.status !== "held") return;
  await store.updateAppointment(appt.id, { status: "cancelled", depositStatus: "released" });
  if (appt.checkoutSessionId) await getPaymentAdapter().expireCheckout(appt.checkoutSessionId).catch(() => undefined);
}

export async function releaseHoldForCheckout(sessionId: string): Promise<void> {
  const store = await getLeadStore();
  const appt = await store?.findAppointmentByCheckoutSession(sessionId);
  if (appt) await releaseHold(appt);
}
