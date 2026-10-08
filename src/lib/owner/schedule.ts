import "server-only";
import { business, getService } from "@/config/business";
import {
  OVERRIDABLE,
  type BookingOptions,
  type CreateAppointmentInput,
  type CreateAppointmentResponse,
  type CustomerOption,
  type NewCustomerInput,
} from "@shared/api";
import { isBlocking } from "@shared/appointment-status";
import { ApiError } from "@/lib/api/http";
import { SlotTakenError, type AppointmentRecord, type LeadStore, type NewLead } from "@/lib/leads/types";
import { computeEstimate } from "@/lib/pricing";
import { easternToUtc, isIsoDate, overlapsWithBuffer, withinWorkHours } from "@/lib/time";
import { lookupZip } from "@/lib/zip";
import { getAppointmentDetail, logAppointmentEvent } from "./appointments";
import { appointmentConfirmationEmail, sendOwnerEmail } from "./email";

/** A booking may start up to this long ago (the owner entering a job they're already at). */
const PAST_GRACE_MS = 15 * 60_000;

export interface ScheduleInput {
  leadId: string;
  date: string;
  time: string;
  durationMinutes: number;
  priceCents: number;
  serviceId: string | null;
  notes: string | null;
  /** Allow outside working hours / days off. Never allows overlapping another job. */
  override: boolean;
  /** Hold the time for a quote instead of confirming it (the customer accepting the quote confirms). */
  quoteFirst?: boolean;
  actor: string;
  requestId: string | null;
}

/**
 * The checks every booking passes: open for business, a real future time,
 * working hours and days off (unless overridden), and no overlap with another
 * job including the travel buffer. Throws ApiError the owner can act on.
 */
export async function assertCanSchedule(
  store: LeadStore,
  input: Pick<ScheduleInput, "date" | "time" | "durationMinutes" | "override"> & {
    /** Rescheduling: the appointment being moved doesn't conflict with itself. */
    excludeId?: string;
  },
): Promise<{ start: Date; end: Date }> {
  if (business.mode !== "LIVE") {
    throw new ApiError("unavailable", "Appointments can't be booked while the site is in pre-launch mode.");
  }
  if (!isIsoDate(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) throw new ApiError("invalid", "Enter a valid date and time.");
  const start = easternToUtc(input.date, input.time);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  if (start.getTime() < Date.now() - PAST_GRACE_MS) throw new ApiError("invalid", "That time is in the past.");

  if (!input.override) {
    const hours = withinWorkHours(start, end);
    if (!hours.ok) throw new ApiError("conflict", `${hours.reason} Book anyway?`, { override: OVERRIDABLE });
    const dayOff = (await store.listTimeOff({ from: input.date })).find((t) => t.day === input.date);
    if (dayOff) throw new ApiError("conflict", "That date is marked as a day off. Book anyway?", { override: OVERRIDABLE });
  }

  const buffer = business.scheduling.travelBufferMinutes;
  const nearby = await store.listAppointments({
    from: new Date(start.getTime() - 24 * 3600_000).toISOString(),
    to: new Date(end.getTime() + 24 * 3600_000).toISOString(),
  });
  const nowIso = new Date().toISOString();
  const clash = nearby.find(
    (a) =>
      a.id !== input.excludeId &&
      isBlocking(a.status) &&
      !(a.status === "held" && a.holdExpiresAt !== null && a.holdExpiresAt < nowIso) &&
      overlapsWithBuffer({ start: new Date(a.startsAt), end: new Date(a.endsAt) }, { start, end }, buffer),
  );
  if (clash) throw new ApiError("conflict", overlapMessage(buffer));
  return { start, end };
}

export const overlapMessage = (buffer: number) =>
  `That overlaps another job (including the ${buffer}-minute travel buffer). Pick another time.`;

/**
 * Books an appointment for an existing lead, after assertCanSchedule: confirmed,
 * or with `quoteFirst` held (like a website request) until the quote is answered.
 */
export async function scheduleAppointment(store: LeadStore, input: ScheduleInput): Promise<AppointmentRecord> {
  const { start, end } = await assertCanSchedule(store, input);
  const buffer = business.scheduling.travelBufferMinutes;
  const status = input.quoteFirst ? "held" : "confirmed";
  let appt: AppointmentRecord;
  try {
    appt = await store.createAppointment({
      leadId: input.leadId,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status,
      quotedPriceCents: input.priceCents,
      customerAgreed: !input.quoteFirst,
      completedRevenueCents: null,
      notes: input.notes,
      source: "owner",
      serviceId: input.serviceId,
      depositCents: null,
      depositStatus: "none",
      checkoutSessionId: null,
      paymentIntentId: null,
      // Until the quote goes out (which extends the hold to the quote's expiry), same as a website request.
      holdExpiresAt: input.quoteFirst
        ? new Date(Math.min(Date.now() + business.booking.requestHoldHours * 3600_000, start.getTime())).toISOString()
        : null,
      bufferMinutes: buffer,
    });
  } catch (err) {
    // The database refuses overlaps even if two bookings race past the check above.
    if (err instanceof SlotTakenError) throw new ApiError("conflict", overlapMessage(buffer));
    throw err;
  }
  await store.addAppointmentEvent({
    appointmentId: appt.id,
    type: "created",
    fromStatus: null,
    toStatus: status,
    note: input.notes,
    actor: input.actor,
    requestId: input.requestId,
  });
  // A held time isn't a booking yet: sending the quote and the customer accepting it move the stage.
  if (!input.quoteFirst) await store.updateLead(input.leadId, { stage: "scheduled" });
  return appt;
}

function newLeadFromApp(input: CreateAppointmentInput, c: NewCustomerInput): NewLead {
  const now = new Date().toISOString();
  return {
    leadType: "quote_request",
    businessMode: business.mode,
    // The booking's requestId: a retried submit finds this lead instead of making a second one.
    idempotencyKey: input.requestId,
    firstName: c.firstName,
    lastName: c.lastName || null,
    email: c.email,
    phone: c.phone ? c.phone.replace(/\D/g, "") : null,
    preferredContact: null,
    vehicleCategory: null,
    vehicleYear: c.vehicleYear ?? null,
    vehicleMake: c.vehicleMake || null,
    vehicleModel: c.vehicleModel || null,
    serviceId: input.serviceId,
    membershipCadence: null,
    futureInterests: [],
    condition: null,
    conditionFlags: [],
    concerns: null,
    zip: c.zip,
    zipEligibility: lookupZip(c.zip).eligibility,
    city: c.city || null,
    serviceAddress: c.serviceAddress,
    locationType: null,
    timeWindows: [],
    preferredDate: input.date,
    notes: null,
    message: null,
    estimate: computeEstimate({ serviceId: input.serviceId }),
    pricingVersion: business.pricingVersion,
    // Entered by the owner with the customer present, not through the website's consent form.
    consent: {
      serviceTextVersion: "owner-entered",
      serviceAcceptedAt: now,
      marketingEmail: false,
      marketingTextVersion: null,
      marketingAcceptedAt: null,
    },
    source: { landingPath: "owner-app", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    // Becomes "scheduled" once the appointment is saved.
    stage: "new",
    photoRefs: [],
  };
}

/** Book from the app: new or existing customer, then (optionally) email the confirmation, or hold the time for a quote. */
export async function bookFromApp(store: LeadStore, actor: string, input: CreateAppointmentInput): Promise<CreateAppointmentResponse> {
  const service = getService(input.serviceId);
  if (!service) throw new ApiError("invalid", "Choose a service.", { serviceId: "Choose a service." });

  const replay = await store.findAppointmentEventByRequestId(input.requestId);
  if (replay) {
    const appointment = await getAppointmentDetail(store, replay.appointmentId);
    return { appointment, confirmation: "skipped", confirmationError: null, alreadyBooked: true };
  }

  // Check the time before creating anything, so a refused booking leaves no stray customer behind.
  const { start } = await assertCanSchedule(store, input);
  if (input.quoteFirst && start.getTime() <= Date.now()) {
    throw new ApiError("invalid", "A quote needs a time that hasn't started yet.", { time: "Pick a later time." });
  }

  let leadId: string;
  if ("leadId" in input.customer) {
    const lead = await store.getLead(input.customer.leadId);
    if (!lead) throw new ApiError("not_found", "That customer doesn't exist.");
    leadId = lead.id;
  } else {
    const { lead } = await store.createLead(newLeadFromApp(input, input.customer.new));
    leadId = lead.id;
  }

  const appt = await scheduleAppointment(store, {
    leadId,
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes,
    priceCents: input.priceCents,
    serviceId: service.id,
    notes: input.notes || null,
    override: input.override,
    quoteFirst: input.quoteFirst,
    actor,
    requestId: input.requestId,
  });

  let confirmation: CreateAppointmentResponse["confirmation"] = "skipped";
  let confirmationError: string | null = null;
  // Quote first: nothing is confirmed yet, so the customer hears from us when the quote is sent.
  if (input.sendConfirmation && !input.quoteFirst) {
    const lead = (await store.getLead(leadId))!;
    const email = appointmentConfirmationEmail({
      firstName: lead.firstName,
      serviceName: service.name,
      startsAt: appt.startsAt,
      address: [lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ") || null,
      priceCents: appt.quotedPriceCents,
    });
    const sent = await sendOwnerEmail(store, leadId, { ...email, sendKey: `booking-${input.requestId}` });
    if (sent.status === "sent") confirmation = "sent";
    else {
      confirmation = "failed";
      confirmationError = sent.status === "not_found" ? "Customer not found." : sent.reason;
    }
    // Emailing marks a new lead "contacted"; it's booked, so keep it "scheduled".
    await store.updateLead(leadId, { stage: "scheduled" });
  }
  if (confirmation !== "skipped") {
    await logAppointmentEvent(store, {
      appointmentId: appt.id,
      type: "note",
      note: confirmation === "sent" ? "Confirmation email sent" : `Confirmation email failed: ${confirmationError}`,
      actor,
    });
  }

  return { appointment: await getAppointmentDetail(store, appt.id), confirmation, confirmationError, alreadyBooked: false };
}

export function bookingOptions(): BookingOptions {
  return {
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      group: s.group,
      priceCents: s.price * 100,
      billing: s.billing,
      durationMinutes: business.booking.durationMinutes[s.id] ?? null,
    })),
    defaultDurationMinutes: business.scheduling.defaultDurationMinutes,
    travelBufferMinutes: business.scheduling.travelBufferMinutes,
    workHours: business.scheduling.workHours,
    bookingOpen: business.mode === "LIVE",
  };
}

/** Customers to book again, most recent first, de-duplicated by email. */
export async function customerOptions(store: LeadStore, q?: string): Promise<CustomerOption[]> {
  const leads = (await store.listLeads({ search: q, limit: 200 })).filter((l) => l.stage !== "spam");
  const seen = new Set<string>();
  const out: CustomerOption[] = [];
  for (const l of leads) {
    const key = l.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      leadId: l.id,
      name: [l.firstName, l.lastName].filter(Boolean).join(" "),
      email: l.email,
      phone: l.phone,
      address: [l.serviceAddress, l.city, l.zip].filter(Boolean).join(", ") || null,
      vehicle: [l.vehicleYear, l.vehicleMake, l.vehicleModel].filter(Boolean).join(" ") || null,
      serviceId: l.serviceId,
    });
    if (out.length >= 50) break;
  }
  return out;
}
