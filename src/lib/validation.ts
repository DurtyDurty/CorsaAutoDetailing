import { z } from "zod";
import { business } from "@/config/business";
import { CONDITION_FLAGS } from "@/lib/pricing";
import { earliestPreferenceDate, isIsoDate, isPastEasternDate } from "@/lib/time";
import { cleanText, normalizeEmail, normalizePhone } from "@/lib/utils";

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

const firstName = text(80).pipe(z.string().min(1, "Enter your first name."));
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
  vehicleCategory: z.enum(vehicleIds).optional().or(z.literal("")).transform((v) => v || null),
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

function arrayField<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]), z.array(schema));
}

const currentYear = new Date().getFullYear();

export const quoteRequestSchema = z
  .object({
    ...meta,
    ...consentFields,
    // Step 1
    serviceId: z.enum(serviceIds, { message: "Choose a service." }),
    vehicleCategory: z.enum(vehicleIds, { message: "Choose a vehicle type." }),
    vehicleYear: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1950 || n > currentYear + 1) {
          ctx.addIssue({ code: "custom", message: `Enter a year between 1950 and ${currentYear + 1}.` });
          return z.NEVER;
        }
        return n;
      }),
    vehicleMake: optionalText(60),
    vehicleModel: optionalText(60),
    // Step 2
    condition: z.enum(["normal", "deeper", "unsure"], { message: "Tell us about the vehicle's condition." }),
    conditionFlags: arrayField(z.enum(CONDITION_FLAGS as [string, ...string[]])).default([]),
    concerns: optionalText(1000),
    // Step 3
    zip: zipSchema,
    city: optionalText(80),
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
    lastName: optionalText(80),
    email: emailSchema,
    phone: phoneSchema.optional().transform((v) => v ?? null),
    preferredContact: contactMethod,
  })
  .superRefine((data, ctx) => {
    if ((data.preferredContact === "phone" || data.preferredContact === "text") && !data.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "A phone number is required for phone or text contact.",
      });
    }
  });

export type LaunchListInput = z.infer<typeof launchListSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type MembershipInterestInput = z.infer<typeof membershipInterestSchema>;
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

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

/** Convert FormData into a plain object; repeated keys become arrays. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue; // files handled separately
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}
