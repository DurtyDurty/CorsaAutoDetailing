/**
 * Which Google Ads conversions the business's records support, and which of
 * them still need reporting. Pure functions: no store, no network.
 *
 * Three conversions, each credited only to a lead that arrived from a Google
 * ad click (gclid / gbraid / wbraid saved with the lead):
 *
 * - inquiry  (secondary)  a booking request or contact form was sent.
 * - booking  (PRIMARY)    the owner confirmed a job for the lead. A held
 *                         request that was declined or expired never counts.
 * - paid     (secondary)  money was actually collected (net of refunds).
 *                         Recorded payments only exist once they succeed, so
 *                         a failed card never counts.
 *
 * Transaction ids are per lead ("booking-<lead id>"), so one customer is one
 * acquisition: a deposit plus the final payment, a reschedule, or a second
 * job for the same click never adds another conversion. When a value changes
 * (a discount, the balance paid), the same id is sent again and Google treats
 * it as an adjustment of that conversion, not a new one.
 */

import type { AppointmentStatus } from "@shared/appointment-status";
import { hasClickId, TOUCH_MAX_AGE_DAYS } from "@/lib/attribution";
import type { AdConversionRecord, LeadSource, LeadStage, LeadType } from "@/lib/leads/types";

export type ConversionKind = AdConversionRecord["kind"];

/** On the calendar as a real job. `held` is a request waiting on the owner. */
const BOOKED: readonly AppointmentStatus[] = ["confirmed", "en_route", "arrived", "in_progress", "completed"];
const INQUIRY_TYPES: readonly LeadType[] = ["quote_request", "contact"];

export interface ConversionLead {
  id: string;
  createdAt: string;
  leadType: LeadType;
  stage: LeadStage;
  source: LeadSource;
}

export interface ConversionAppointment {
  id: string;
  leadId: string;
  status: AppointmentStatus;
  createdAt: string;
  /** When it became a confirmed job (the confirm event), else null. */
  confirmedAt: string | null;
  /** Price after discount. */
  totalCents: number;
  /** Net collected (payments minus refunds), from the payments ledger. */
  collectedCents: number;
  /** When the first successful payment was recorded. */
  firstPaidAt: string | null;
}

export interface ConversionEvent {
  kind: ConversionKind;
  transactionId: string;
  leadId: string;
  appointmentId: string | null;
  eventAt: string;
  valueCents: number;
  click: { gclid: string | null; gbraid: string | null; wbraid: string | null };
}

export interface SkippedConversion {
  kind: ConversionKind;
  leadId: string;
  reason: string;
}

const DAY = 86_400_000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const earliest = (xs: (string | null)[]) => xs.filter((x): x is string => Boolean(x)).sort()[0] ?? null;

export function transactionId(kind: ConversionKind, leadId: string): string {
  return `${kind}-${leadId}`;
}

/**
 * Every conversion the records support right now. Leads without a Google ad
 * click are ignored (they are not Google Ads conversions). Conversions more
 * than 90 days after the click, which Google won't accept, are returned as
 * skipped with the reason.
 */
export function deriveConversions(
  leads: ConversionLead[],
  appointments: ConversionAppointment[],
): { events: ConversionEvent[]; skipped: SkippedConversion[] } {
  const byLead = new Map<string, ConversionAppointment[]>();
  for (const a of appointments) byLead.set(a.leadId, [...(byLead.get(a.leadId) ?? []), a]);

  const events: ConversionEvent[] = [];
  const skipped: SkippedConversion[] = [];

  for (const lead of leads) {
    const s = lead.source;
    const click = { gclid: s.gclid ?? null, gbraid: s.gbraid ?? null, wbraid: s.wbraid ?? null };
    if (!hasClickId(click) || lead.stage === "spam") continue;
    const clickAt = s.clickSeenAt ?? s.firstSeenAt ?? lead.createdAt;

    const push = (kind: ConversionKind, appointmentId: string | null, eventAt: string, valueCents: number) => {
      // Google rejects a conversion dated before its click; never send one.
      const at = Date.parse(eventAt) < Date.parse(clickAt) ? clickAt : eventAt;
      if (Date.parse(at) - Date.parse(clickAt) > TOUCH_MAX_AGE_DAYS * DAY) {
        skipped.push({ kind, leadId: lead.id, reason: `More than ${TOUCH_MAX_AGE_DAYS} days after the ad click` });
        return;
      }
      events.push({ kind, transactionId: transactionId(kind, lead.id), leadId: lead.id, appointmentId, eventAt: at, valueCents: Math.max(0, Math.round(valueCents)), click });
    };

    if (INQUIRY_TYPES.includes(lead.leadType)) push("inquiry", null, lead.createdAt, 0);

    const appts = byLead.get(lead.id) ?? [];
    const booked = appts.filter((a) => BOOKED.includes(a.status)).sort((a, b) => (a.confirmedAt ?? a.createdAt).localeCompare(b.confirmedAt ?? b.createdAt));
    const first = booked[0];
    if (first) push("booking", first.id, first.confirmedAt ?? first.createdAt, first.totalCents);

    // Money collected on any of the lead's jobs, including a deposit kept on a cancelled one.
    const collected = sum(appts.map((a) => Math.max(0, a.collectedCents)));
    const paidAt = earliest(appts.filter((a) => a.collectedCents > 0).map((a) => a.firstPaidAt));
    if (collected > 0 && paidAt) {
      const paidAppt = appts.filter((a) => a.collectedCents > 0).sort((a, b) => (a.firstPaidAt ?? "").localeCompare(b.firstPaidAt ?? ""))[0];
      push("paid", paidAppt?.id ?? null, paidAt, collected);
    }
  }
  return { events, skipped };
}

export type UploadReason = "new" | "retry" | "adjust";

/**
 * Conversions to send: never sent, failed last time, or sent with a value that
 * has since changed (re-sent under the same transaction id as an adjustment).
 * Already-sent conversions with the same value are left alone.
 */
export function planUploads(
  events: ConversionEvent[],
  ledger: Pick<AdConversionRecord, "transactionId" | "status" | "valueCents">[],
  kinds: readonly ConversionKind[],
): { event: ConversionEvent; reason: UploadReason }[] {
  const prior = new Map(ledger.map((r) => [r.transactionId, r]));
  const out: { event: ConversionEvent; reason: UploadReason }[] = [];
  for (const event of events) {
    if (!kinds.includes(event.kind)) continue;
    const row = prior.get(event.transactionId);
    if (!row) out.push({ event, reason: "new" });
    else if (row.status === "failed") out.push({ event, reason: "retry" });
    else if (row.valueCents !== event.valueCents && event.kind !== "inquiry") out.push({ event, reason: "adjust" });
  }
  return out;
}
