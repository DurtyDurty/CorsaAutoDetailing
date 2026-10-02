import { z } from "zod";
import { business } from "@/config/business";
import { CONDITION_FLAGS } from "@/lib/pricing";
import { earliestPreferenceDate, isIsoDate, isPastEasternDate } from "@/lib/time";
import { cleanLine, cleanText, normalizeEmail, normalizePhone } from "@/lib/utils";

const serviceIds = business.services.map((s) => s.id) as [string, ...string[]];
const vehicleIds = business.vehicleCategories.map((v) => v.id) as [string, ...string[]];
const windowIds = business.scheduling.timeWindows.map((w) => w.id) as [string, ...string[]];
const cadenceIds = business.membership.cadences.map((c) => c.id) as [string, ...string[]];

const text = (max: number) => z.string().transform((v) => cleanText(v, max));
const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? cleanText(v, max) : ""))
    .transform((v) => (v === "" ? null : v));
/** One-line fields (names, make, address). They end up in email subjects and "Key: value" lines, so no line breaks. */
const line = (max: number) => z.string().transform((v) => cleanLine(v, max));
const optionalLine = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? cleanLine(v, max) : ""))
    .transform((v) => (v === "" ? null : v));

/**
 * Names open the acknowledgement email ("Hi <name>,") that goes to whatever
 * address was typed in. Letters, spaces, apostrophes and hyphens only, plus a
 * period that ends an initial ("J. R."), so the form can't be used to mail
 * someone a link, a web address or a phone number.
 */
const NAME = /^[\p{L}\p{M}](?:[\p{L}\p{M}'’ -]|\.(?![\p{L}\p{M}]))*$/u;
const NAME_MESSAGE = "Use letters only for the name.";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address.")
  .max(254)
  .email("Enter a valid email address.")
  .transform(normalizeEmail);

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const digits = normalizePhone(v);
    if (!digits) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit U.S. phone number." });
      return z.NEVER;
    }
    return digits;
  });

export const zipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Enter a 5-digit ZIP code.");

const firstName = line(50).pipe(z.string().min(1, "Enter your first name.").regex(NAME, NAME_MESSAGE));
const contactMethod = z.enum(["email", "phone", "text"]);

/** Shared hidden/meta fields. */
const meta = {
  idempotencyKey: z.string().uuid("Please refresh the page and try again."),
  /** Honeypot: must be empty. Bots that fill it are silently accepted and discarded. */
  website: z.string().max(0).optional().or(z.literal("")),
  landingPath: optionalText(200),
  referrer: optionalText(300),
  utmSource: optionalText(80),
  utmMedium: optionalText(80),
  utmCampaign: optionalText(120),
  utmTerm: optionalText(120),
  utmContent: optionalText(120),
  gclid: optionalText(250),
  gbraid: optionalText(250),
  wbraid: optionalText(250),
  firstSeenAt: optionalText(40),
  clickSeenAt: optionalText(40),
};

const consentFields = {
  serviceConsent: z.literal("on", { message: "Please confirm we may use your details to respond." }),
  marketingEmail: z
    .string()
    .optional()
    .transform((v) => v === "on"),
};

export const launchListSchema = z.object({
  ...meta,
  ...consentFields,
  firstName,
  email: emailSchema,
  zip: zipSchema,
  phone: phoneSchema.optional().transform((v) => v ?? null),
  serviceId: z.enum(serviceIds).optional().or(z.literal("")).transform((v) => v || null),
  preferredContact: contactMethod.optional().or(z.literal("")).transform((v) => v || null),
});

export const contactSchema = z.object({
  ...meta,
  ...consentFields,
  firstName,
  email: emailSchema,
  phone: phoneSchema.optional().transform((v) => v ?? null),
  message: text(2000).pipe(z.string().min(5, "Tell us a little about what you need.")),
});

export const membershipInterestSchema = z.object({
  ...meta,
  ...consentFields,
  firstName,
  email: emailSchema,
  zip: zipSchema,
  vehicleCategory: z.enum(vehicleIds).optional().or(z.literal("")).transform((v) => v || null),
  cadence: z.enum(cadenceIds).optional().or(z.literal("")).transform((v) => v || null),
  futureInterests: z.array(z.enum(business.futureServices as unknown as [string, ...string[]])).max(10).default([]),
  notes: optionalText(1000),
});

/** Checkbox groups: a handful of known values, stored once each. */
function arrayField<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]),
    z
      .array(schema)
      .max(30)
      .transform((items) => [...new Set(items)]),
  );
}

const currentYear = new Date().getFullYear();

const quoteRequestFields = z
  .object({
    ...meta,
    ...consentFields,
    // Step 1
    serviceId: z.enum(serviceIds, { message: "Choose a service." }),
    vehicleYear: z
      .string({ message: "Enter the vehicle year." })
      .trim()
      .transform((v, ctx) => {
        const n = Number(v);
        if (!v || !Number.isInteger(n) || n < 1950 || n > currentYear + 1) {
          ctx.addIssue({ code: "custom", message: `Enter a year between 1950 and ${currentYear + 1}.` });
          return z.NEVER;
        }
        return n;
      }),
    vehicleMake: line(60).pipe(z.string().min(1, "Enter the vehicle make.")),
    vehicleModel: line(60).pipe(z.string().min(1, "Enter the vehicle model.")),
    // Step 2
    condition: z.enum(["normal", "deeper", "unsure"], { message: "Tell us about the vehicle's condition." }),
    conditionFlags: arrayField(z.enum(CONDITION_FLAGS as [string, ...string[]])).default([]),
    concerns: optionalText(1000),
    // Step 3
    serviceAddress: line(200).pipe(z.string().min(5, "Enter the street address where the vehicle will be.")),
    zip: zipSchema,
    city: optionalLine(80),
    locationType: z.enum(["home", "work", "other"], { message: "Where would the vehicle be?" }),
    timeWindows: arrayField(z.enum(windowIds)).default([]),
    preferredDate: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        if (!isIsoDate(v)) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date." });
          return z.NEVER;
        }
        if (isPastEasternDate(v)) {
          ctx.addIssue({ code: "custom", message: "That date has already passed (Eastern time)." });
          return z.NEVER;
        }
        const earliest = earliestPreferenceDate();
        if (earliest === null) {
          ctx.addIssue({
            code: "custom",
            message: "We can't take date preferences until an opening date is set. Choose time windows instead.",
          });
          return z.NEVER;
        }
        if (v < earliest) {
          ctx.addIssue({ code: "custom", message: `The earliest date we can consider is ${earliest}.` });
          return z.NEVER;
        }
        return v;
      }),
    notes: optionalText(1500),
    // Step 4
    firstName,
    lastName: optionalLine(50).pipe(z.string().regex(NAME, NAME_MESSAGE).nullable()),
    email: emailSchema,
    phone: phoneSchema.optional().transform((v) => v ?? null),
    preferredContact: contactMethod,
    priceAcknowledgment: z.literal("on", {
      message: "Please confirm you understand the price is an estimate until we inspect the vehicle.",
    }),
  });

function requirePhone(data: { phone: string | null }, ctx: z.RefinementCtx) {
  if (!data.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter your phone number." });
  }
}

export const quoteRequestSchema = quoteRequestFields.superRefine(requirePhone);

/** Calendar request (deposits off) = the request fields + a chosen open time. */
export const calendarRequestSchema = quoteRequestFields
  .extend({
    slotStart: z.string({ message: "Choose a date and time." }).datetime({ message: "Choose a date and time." }),
  })
  .superRefine(requirePhone);
export type CalendarRequestInput = z.infer<typeof calendarRequestSchema>;

/** Online booking = the request fields + a chosen slot + agreeing to the deposit policy. */
export const bookingRequestSchema = quoteRequestFields
  .extend({
    slotStart: z.string({ message: "Choose a date and time." }).datetime({ message: "Choose a date and time." }),
    bookingPolicy: z.literal("on", { message: "Please agree to the deposit, cancellation and weather policy." }),
  })
  .superRefine(requirePhone);

export type LaunchListInput = z.infer<typeof launchListSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type MembershipInterestInput = z.infer<typeof membershipInterestSchema>;
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export type FieldErrors = Record<string, string>;

/** Flatten a Zod error into a `{ field: message }` map (first message wins). */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** The largest real form sends about 40 fields. Anything far beyond that isn't one of ours. */
const MAX_FORM_FIELDS = 200;

/**
 * Convert FormData into a plain object; repeated keys become arrays. A request
 * with more text fields than any form has is treated as empty, so it fails
 * validation instead of being processed.
 */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out = new Map<string, string | string[]>();
  let fields = 0;
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue; // files handled separately
    if (++fields > MAX_FORM_FIELDS) return {};
    const existing = out.get(key);
    if (existing === undefined) out.set(key, value);
    else if (Array.isArray(existing)) existing.push(value);
    else out.set(key, [existing, value]);
  }
  return Object.fromEntries(out);
}
