"use server";

import { headers } from "next/headers";
import { business, getService, type ServiceId } from "@/config/business";
import { isSlotAvailable } from "@/lib/availability";
import { bookingEnabled, calendarRequestsEnabled, calendarState, releaseToken } from "@/lib/booking";
import { notifyForLead } from "@/lib/notifications";
import { todayEastern } from "@/lib/time";
import { SlotTakenError, type LeadRecord, type LeadStore, type NewLead } from "@/lib/leads/types";
import { getPaymentAdapter } from "@/lib/payments";
import { intake, baseLead, type IntakeResult } from "@/lib/leads/intake";
import { getLeadStore } from "@/lib/leads/store";
import { photosEnabled, storeLeadPhotos } from "@/lib/photos";
import { computeEstimate } from "@/lib/pricing";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import { lookupZip } from "@/lib/zip";
import {
  contactSchema,
  launchListSchema,
  membershipInterestSchema,
  quoteRequestSchema,
  bookingRequestSchema,
  calendarRequestSchema,
  type BookingRequestInput,
  type CalendarRequestInput,
  type QuoteRequestInput,
} from "@/lib/validation";

export type FormResult = IntakeResult & { redirectTo?: string };

export async function submitLaunchList(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "launch_list",
    schema: launchListSchema,
    formData,
    build: (d) => ({
      ...baseLead("launch_list", d),
      phone: d.phone,
      zip: d.zip,
      zipEligibility: lookupZip(d.zip).eligibility,
      serviceId: d.serviceId,
      preferredContact: d.preferredContact,
    }),
  });
  return withRedirect(result, "launch-list");
}

export async function submitContact(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "contact",
    schema: contactSchema,
    formData,
    build: (d) => ({
      ...baseLead("contact", d),
      phone: d.phone,
      message: d.message,
    }),
  });
  return withRedirect(result, "contact");
}

export async function submitMembershipInterest(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  if (!business.membership.enabled) {
    return { status: "unavailable", message: "Maintenance plans are not open for interest right now." };
  }
  const result = await intake({
    leadType: "membership_interest",
    schema: membershipInterestSchema,
    formData,
    build: (d) => ({
      ...baseLead("membership_interest", d),
      zip: d.zip,
      zipEligibility: lookupZip(d.zip).eligibility,
      vehicleCategory: d.vehicleCategory,
      membershipCadence: d.cadence,
      futureInterests: d.futureInterests,
      notes: d.notes,
    }),
  });
  return withRedirect(result, "membership");
}

function buildQuoteLead(d: QuoteRequestInput): NewLead {
  const base = baseLead("quote_request", d);
  return {
    ...base,
    // Schema requires the acknowledgment checkbox; record when it was given.
    consent: {
      ...base.consent,
      priceAcknowledgmentTextVersion: business.consent.priceAcknowledgmentTextVersion,
      priceAcknowledgedAt: base.consent.serviceAcceptedAt,
    },
    lastName: d.lastName,
    phone: d.phone,
    preferredContact: d.preferredContact,
    vehicleYear: d.vehicleYear,
    vehicleMake: d.vehicleMake,
    vehicleModel: d.vehicleModel,
    serviceId: d.serviceId,
    condition: d.condition,
    conditionFlags: d.conditionFlags,
    concerns: d.concerns,
    zip: d.zip,
    zipEligibility: lookupZip(d.zip).eligibility,
    city: d.city,
    serviceAddress: d.serviceAddress,
    locationType: d.locationType,
    timeWindows: d.timeWindows,
    preferredDate: d.preferredDate,
    notes: d.notes,
    estimate: computeEstimate({
      serviceId: d.serviceId,
      condition: d.condition,
      conditionFlags: d.conditionFlags,
    }),
  };
}

async function savePhotos(lead: LeadRecord, fd: FormData) {
  if (!photosEnabled()) return;
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;
  const { refs } = await storeLeadPhotos(lead.id, files);
  if (refs.length > 0) {
    const store = await getLeadStore();
    await store?.updateLead(lead.id, { photoRefs: refs });
  }
}

export async function submitQuoteRequest(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "quote_request",
    schema: quoteRequestSchema,
    formData,
    build: buildQuoteLead,
    afterSave: savePhotos,
  });
  return withRedirect(result, "request");
}

/** Website requests still waiting on the owner, each holding a time, with who asked. */
async function openRequests(store: LeadStore) {
  const now = new Date().toISOString();
  const holds = (await store.listAppointments({ from: now })).filter(
    (a) => a.status === "held" && a.source === "online" && a.depositStatus === "none" && (!a.holdExpiresAt || a.holdExpiresAt > now),
  );
  const leads = await store.getLeads([...new Set(holds.map((h) => h.leadId))]);
  return { holds, leads };
}

/** "Morning, around 9:30": what the customer asked for, kept on the held appointment. */
const PART_LABEL = { morning: "Morning", afternoon: "Afternoon", either: "Morning or afternoon" } as const;
const requestSummary = (d: Pick<CalendarRequestInput, "dayPart" | "preferredTime">) => `${PART_LABEL[d.dayPart]}${d.preferredTime ? `, ${d.preferredTime}` : ""}`;

/** The placeholder start the form sends must sit inside the part of the day the customer chose. */
function inPart(slotIso: string, part: string): boolean {
  const w = business.booking.arrivalWindows.find((x) => x.id === part);
  if (!w) return part === "either";
  const t = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: business.timeZone }).format(new Date(slotIso));
  return t >= w.from && t <= w.to;
}

/**
 * Calendar request (deposits off): the customer picks a day and morning,
 * afternoon or either (plus an optional preferred time). The window is held for
 * the owner, who sets the exact time with the quote. No payment. Emails go out
 * after the hold exists, so they can name the day.
 *
 * A hold costs the visitor nothing and takes the time off the calendar, so holds
 * are rationed: a couple per customer and a ceiling overall. Past the ceiling the
 * request is still saved and the owner is told, but no time is held.
 */
export async function submitCalendarRequest(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  if (!calendarRequestsEnabled()) {
    return { status: "unavailable", message: "Online scheduling isn't available right now. Please try again shortly or send us a message." };
  }
  const store = await getLeadStore();
  if (!store) return { status: "unavailable", message: "We can't take requests right now. Please try again shortly." };

  const requestedService = String(formData.get("serviceId") ?? "");
  const requestedSlot = String(formData.get("slotStart") ?? "");
  const requestedPart = formData.get("dayPart");
  if (requestedSlot && typeof requestedPart === "string" && requestedPart && !inPart(requestedSlot, requestedPart)) return SLOT_TAKEN;
  if (getService(requestedService) && requestedSlot) {
    await store.releaseExpiredHolds();
    const free = isSlotAvailable({ serviceId: requestedService as ServiceId, ...(await calendarState(store)), startIso: requestedSlot });
    if (!free) return SLOT_TAKEN;
  }

  const open = await openRequests(store);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const formKey = String(formData.get("idempotencyKey") ?? "");
  const theirs = new Set(
    open.leads.filter((l) => l.idempotencyKey !== formKey && (l.email === email || (phone !== null && l.phone === phone))).map((l) => l.id),
  );
  if (open.holds.filter((h) => theirs.has(h.leadId)).length >= business.booking.maxOpenRequestsPerCustomer) return TOO_MANY_REQUESTS;
  const canHold = open.holds.length < business.booking.maxOpenRequests;

  let input: CalendarRequestInput | null = null;
  const result = await intake({
    leadType: "quote_request",
    schema: calendarRequestSchema,
    formData,
    // Without a held time this is an ordinary request: the usual emails go out now.
    notify: !canHold,
    build: (d) => {
      input = d;
      return { ...buildQuoteLead(d), preferredDate: todayEastern(new Date(d.slotStart)) };
    },
    afterSave: savePhotos,
  });
  if (result.status !== "ok" || !input || !canHold) return withRedirect(result, "request");
  const d: CalendarRequestInput = input;
  const lead = await store.getLead(result.leadId);
  if (!lead) return { status: "error", message: "Something went wrong saving your request. Please try again." };
  // A resubmitted form (same idempotency key) already holds its time.
  if (!result.created && (await store.listAppointments({ leadId: lead.id })).some((a) => a.status === "held")) {
    return withRedirect(result, "request");
  }

  const serviceId = d.serviceId as ServiceId;
  const startsAt = new Date(d.slotStart);
  const minutes = business.booking.durationMinutes[serviceId] ?? business.scheduling.defaultDurationMinutes;
  const holdUntil = Math.min(Date.now() + business.booking.requestHoldHours * 3600_000, startsAt.getTime());
  let appt;
  try {
    await store.releaseExpiredHolds();
    appt = await store.createAppointment({
      leadId: lead.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + minutes * 60_000).toISOString(),
      status: "held",
      // Priced from the package on this submission, so a replayed form key can't pair one package with another's price.
      quotedPriceCents: quotedCents(d),
      customerAgreed: false,
      completedRevenueCents: null,
      notes: requestSummary(d),
      source: "online",
      serviceId,
      depositCents: null,
      depositStatus: "none",
      checkoutSessionId: null,
      paymentIntentId: null,
      holdExpiresAt: new Date(holdUntil).toISOString(),
      bufferMinutes: business.scheduling.travelBufferMinutes,
    });
  } catch (err) {
    // The request stays saved (it shows in the owner's Inbox); emails wait until a time is held,
    // so a customer who picks another time isn't emailed twice.
    if (err instanceof SlotTakenError) return SLOT_TAKEN;
    throw err;
  }
  await store.addAppointmentEvent({
    appointmentId: appt.id,
    type: "created",
    fromStatus: null,
    toStatus: "held",
    note: `Requested on the website: ${requestSummary(d)}. Send a quote with the exact time`,
    actor: "website",
    requestId: null,
  });
  await notifyForLead(store, lead);
  return withRedirect(result, "request");
}

function quotedCents(d: Pick<QuoteRequestInput, "serviceId" | "condition" | "conditionFlags">): number {
  const estimate = computeEstimate({ serviceId: d.serviceId, condition: d.condition, conditionFlags: d.conditionFlags });
  return Math.round((estimate?.total ?? 0) * 100);
}

const TOO_MANY_REQUESTS: FormResult = {
  status: "invalid",
  fieldErrors: { slotStart: "You already have requests waiting for us to confirm. We'll reply about those first." },
  message: "You already have requests waiting for us to confirm. To change one, reply to our email or send us a message.",
};

const SLOT_TAKEN: FormResult = {
  status: "invalid",
  fieldErrors: { slotStart: "That time was just booked by someone else. Please choose another day or part of the day." },
  message: "That time is no longer available.",
};

/**
 * Origin for Stripe's return URLs: the site's own address. The request's Host
 * header is only used for a local test server, never to build a link elsewhere.
 */
async function requestOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return business.brand.canonicalDomain.replace(/\/$/, "");
}

/**
 * Online booking: validate → re-check the slot → save the lead (no emails yet)
 * → hold the slot → hosted deposit checkout. Confirmation emails go out only
 * once the deposit is paid (see lib/booking.ts).
 */
export async function submitBooking(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  if (!bookingEnabled()) {
    return { status: "unavailable", message: "Online booking isn't available right now. Please try again shortly or send us a message." };
  }
  const store = await getLeadStore();
  if (!store) return { status: "unavailable", message: "We can't take bookings right now. Please try again shortly." };

  // Server-trusted re-check before anything is saved.
  const requestedService = String(formData.get("serviceId") ?? "");
  const requestedSlot = String(formData.get("slotStart") ?? "");
  if (getService(requestedService) && requestedSlot) {
    const free = isSlotAvailable({
      serviceId: requestedService as ServiceId,
      ...(await calendarState(store)),
      startIso: requestedSlot,
    });
    if (!free) return SLOT_TAKEN;
  }

  let input: BookingRequestInput | null = null;
  const result = await intake({
    leadType: "quote_request",
    schema: bookingRequestSchema,
    formData,
    notify: false,
    build: (d) => {
      input = d;
      const lead = buildQuoteLead(d);
      return {
        ...lead,
        consent: {
          ...lead.consent,
          bookingPolicyTextVersion: business.booking.policyTextVersion,
          bookingPolicyAcceptedAt: lead.consent.serviceAcceptedAt,
        },
      };
    },
    afterSave: savePhotos,
  });
  if (result.status !== "ok" || !input) return withRedirect(result, "request");
  const d: BookingRequestInput = input;
  const lead = await store.getLead(result.leadId);
  if (!lead) return { status: "error", message: "Something went wrong saving your booking. Please try again." };

  const serviceId = d.serviceId as ServiceId;
  const service = getService(serviceId)!;
  // bookingEnabled() guarantees both are set for every package.
  const durationMinutes = business.booking.durationMinutes[serviceId]!;
  const depositCents = business.booking.depositCents[serviceId]!;
  const startsAt = new Date(d.slotStart);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  let appt;
  try {
    appt = await store.bookOnlineSlot({
      leadId: lead.id,
      serviceId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      quotedPriceCents: quotedCents(d),
      depositCents,
      holdMinutes: business.booking.holdMinutes,
      bufferMinutes: business.scheduling.travelBufferMinutes,
    });
  } catch (err) {
    if (err instanceof SlotTakenError) return SLOT_TAKEN;
    throw err;
  }

  await store.addAppointmentEvent({
    appointmentId: appt.id,
    type: "created",
    fromStatus: null,
    toStatus: "held",
    note: "Booked online; waiting for the deposit",
    actor: "website",
    requestId: null,
  });

  const origin = await requestOrigin();
  const session = await getPaymentAdapter().createCheckout({
    appointmentId: appt.id,
    leadId: lead.id,
    description: `Deposit: ${service.name}`,
    amountCents: depositCents,
    customerEmail: lead.email,
    successUrl: `${origin}/booking/confirmed`,
    cancelUrl: `${origin}/booking/cancelled?appointment=${appt.id}&t=${releaseToken(appt.id, lead)}`,
    expiresAt: new Date(Date.now() + business.booking.checkoutMinutes * 60_000),
  });
  await store.updateAppointment(appt.id, { checkoutSessionId: session.id });
  return { status: "ok", leadId: lead.id, created: result.created, redirectTo: session.url };
}
function withRedirect(result: IntakeResult, kind: string): FormResult {
  if (result.status !== "ok") return result;
  return { ...result, redirectTo: `/thanks/${kind}?ref=${encodeURIComponent(result.leadId)}` };
}
