import "server-only";
import { z } from "zod";
import { business } from "@/config/business";
import { getLeadStore } from "@/lib/leads/store";
import { cleanClickId, cleanPath, cleanReferrer, cleanTag, TOUCH_MAX_AGE_DAYS } from "@/lib/attribution";
import type { LeadRecord, LeadSource, LeadType, NewLead } from "@/lib/leads/types";
import { notifyForLead } from "@/lib/notifications";
import { limitFormSubmission } from "@/lib/rate-limit";
import { fieldErrors, formDataToObject, type FieldErrors } from "@/lib/validation";

export type IntakeResult =
  | { status: "ok"; leadId: string; created: boolean }
  | { status: "invalid"; fieldErrors: FieldErrors; message: string }
  | { status: "rate_limited"; message: string; retryAfterSeconds: number }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

const UNAVAILABLE_MESSAGE =
  "We can't save requests right now. Please try again shortly" +
  (business.contact.email ? ` or email ${business.contact.email}.` : ".");

/** Base record fields shared by every lead type. */
export function baseLead(
  leadType: LeadType,
  data: {
    idempotencyKey: string;
    firstName: string;
    email: string;
    marketingEmail: boolean;
    landingPath: string | null;
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    firstSeenAt?: string | null;
    clickSeenAt?: string | null;
  },
): NewLead {
  const now = new Date().toISOString();
  return {
    leadType,
    businessMode: business.mode,
    idempotencyKey: data.idempotencyKey,
    firstName: data.firstName,
    lastName: null,
    email: data.email,
    phone: null,
    preferredContact: null,
    vehicleCategory: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    serviceId: null,
    membershipCadence: null,
    futureInterests: [],
    condition: null,
    conditionFlags: [],
    concerns: null,
    zip: null,
    zipEligibility: null,
    city: null,
    serviceAddress: null,
    locationType: null,
    timeWindows: [],
    preferredDate: null,
    notes: null,
    message: null,
    estimate: null,
    pricingVersion: business.pricingVersion,
    consent: {
      serviceTextVersion: business.consent.serviceTextVersion,
      serviceAcceptedAt: now,
      marketingEmail: data.marketingEmail,
      marketingTextVersion: data.marketingEmail ? business.consent.marketingTextVersion : null,
      marketingAcceptedAt: data.marketingEmail ? now : null,
    },
    source: leadSource(data, new Date(now)),
    photoRefs: [],
  };
}

/**
 * Attribution from the form's hidden fields. Values come from the browser, so
 * each is re-cleaned: paths without query strings, referrer hosts only, tags
 * without anything that looks like contact details, opaque click ids, and
 * timestamps within Google's 90-day conversion window.
 */
export function leadSource(
  d: {
    landingPath: string | null;
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    firstSeenAt?: string | null;
    clickSeenAt?: string | null;
  },
  now: Date,
): LeadSource {
  const when = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t) || t > now.getTime() + 60_000 || now.getTime() - t > TOUCH_MAX_AGE_DAYS * 86_400_000) return null;
    return new Date(t).toISOString();
  };
  // A referrer may arrive as a full URL (older forms) or as a host (stored touch).
  const ref = d.referrer && !d.referrer.includes("://") ? `https://${d.referrer}` : d.referrer;
  const clickSeenAt = when(d.clickSeenAt);
  const clicks = {
    gclid: cleanClickId(d.gclid),
    gbraid: cleanClickId(d.gbraid),
    wbraid: cleanClickId(d.wbraid),
  };
  const anyClick = Boolean(clicks.gclid || clicks.gbraid || clicks.wbraid);
  return {
    landingPath: cleanPath(d.landingPath),
    referrer: cleanReferrer(ref),
    utmSource: cleanTag(d.utmSource),
    utmMedium: cleanTag(d.utmMedium),
    utmCampaign: cleanTag(d.utmCampaign),
    utmTerm: cleanTag(d.utmTerm),
    utmContent: cleanTag(d.utmContent),
    ...clicks,
    firstSeenAt: when(d.firstSeenAt),
    clickSeenAt: anyClick ? clickSeenAt : null,
  };
}

/**
 * Shared intake pipeline: rate limit → honeypot → validate → save → notify.
 * `build` converts validated input into a NewLead and may run extra async work
 * (e.g., estimate). `afterSave` runs only for newly created leads (e.g., photos).
 */
export async function intake<S extends z.ZodTypeAny>(opts: {
  leadType: LeadType;
  schema: S;
  formData: FormData;
  build: (input: z.output<S>) => NewLead | Promise<NewLead>;
  afterSave?: (lead: LeadRecord, formData: FormData) => Promise<void>;
  /** false = skip the owner/customer emails (online bookings email once the deposit is paid). */
  notify?: boolean;
}): Promise<IntakeResult> {
  const store = await getLeadStore();
  if (!store) return { status: "unavailable", message: UNAVAILABLE_MESSAGE };

  const limit = await limitFormSubmission(opts.leadType);
  if (!limit.ok) {
    return {
      status: "rate_limited",
      retryAfterSeconds: limit.retryAfterSeconds,
      message: `Too many submissions from this connection. Please wait about ${Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))} minute(s) and try again.`,
    };
  }

  const raw = formDataToObject(opts.formData);
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // Honeypot filled → pretend success without saving anything.
    if ("website" in errors) {
      return { status: "ok", leadId: "00000000-0000-4000-8000-000000000000", created: false };
    }
    return { status: "invalid", fieldErrors: errors, message: "Please fix the highlighted fields." };
  }

  let record: NewLead;
  try {
    record = await opts.build(parsed.data);
  } catch {
    return { status: "error", message: "Something went wrong preparing your request. Please try again." };
  }

  let saved: { lead: LeadRecord; created: boolean };
  try {
    saved = await store.createLead(record);
  } catch (err) {
    console.error("[intake] save failed:", err instanceof Error ? err.message : err);
    return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  }

  if (saved.created) {
    if (opts.afterSave) {
      try {
        await opts.afterSave(saved.lead, opts.formData);
      } catch (err) {
        console.error("[intake] afterSave failed:", err instanceof Error ? err.message : err);
      }
    }
    // Lead is durable; notification failure is recorded, never surfaced as a form error.
    if (opts.notify !== false) await notifyForLead(store, saved.lead);
  }

  return { status: "ok", leadId: saved.lead.id, created: saved.created };
}
