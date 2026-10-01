import { describe, expect, it } from "vitest";
import { fieldErrors, formDataToObject, launchListSchema, quoteRequestSchema } from "@/lib/validation";
import { todayEastern, addDays } from "@/lib/time";

const KEY = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
}

function without<T extends object>(obj: T, key: keyof T): Record<string, string | string[]> {
  const copy = { ...obj } as Record<string, string | string[]>;
  delete copy[key as string];
  return copy;
}

const validQuote = {
  idempotencyKey: KEY,
  serviceId: "signature-full",
  vehicleYear: "2019",
  vehicleMake: "Lexus",
  vehicleModel: "IS F",
  condition: "normal",
  serviceAddress: "123 Main St",
  zip: "32068",
  locationType: "home",
  timeWindows: ["weekday-morning", "saturday"],
  firstName: "Herson",
  email: "Owner@Example.com ",
  phone: "(904) 555-0100",
  preferredContact: "email",
  serviceConsent: "on",
  priceAcknowledgment: "on",
};

describe("launchListSchema", () => {
  it("accepts a minimal valid signup and normalises email", () => {
    const r = launchListSchema.safeParse(
      formDataToObject(fd({ idempotencyKey: KEY, firstName: " Ana ", email: "ANA@example.com", zip: "32003", serviceConsent: "on" })),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ana@example.com");
      expect(r.data.firstName).toBe("Ana");
      expect(r.data.marketingEmail).toBe(false);
    }
  });
  it("requires consent, valid zip, valid email", () => {
    const r = launchListSchema.safeParse(formDataToObject(fd({ idempotencyKey: KEY, firstName: "", email: "nope", zip: "1234" })));
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.firstName).toBeDefined();
      expect(errs.email).toBeDefined();
      expect(errs.zip).toBeDefined();
      expect(errs.serviceConsent).toBeDefined();
    }
  });
  it("flags a filled honeypot", () => {
    const r = launchListSchema.safeParse(
      formDataToObject(fd({ idempotencyKey: KEY, firstName: "Bot", email: "b@example.com", zip: "32003", serviceConsent: "on", website: "http://spam" })),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).website).toBeDefined();
  });
});

describe("quoteRequestSchema", () => {
  it("accepts a valid request", () => {
    const r = quoteRequestSchema.safeParse(formDataToObject(fd(validQuote)));
    expect(r.success, JSON.stringify(!r.success && r.error.issues)).toBe(true);
    if (r.success) {
      expect(r.data.vehicleYear).toBe(2019);
      expect(r.data.timeWindows).toEqual(["weekday-morning", "saturday"]);
      expect(r.data.email).toBe("owner@example.com");
      expect(r.data.phone).toBe("9045550100");
      expect(r.data.serviceAddress).toBe("123 Main St");
    }
  });
  it("requires a phone number", () => {
    const r = quoteRequestSchema.safeParse(formDataToObject(fd(without(validQuote, "phone"))));
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).phone).toMatch(/phone number/i);
  });
  it("requires the price-estimate acknowledgment", () => {
    const r = quoteRequestSchema.safeParse(formDataToObject(fd(without(validQuote, "priceAcknowledgment"))));
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).priceAcknowledgment).toMatch(/estimate/i);
  });
  it("requires year, make, model and a service address", () => {
    const r = quoteRequestSchema.safeParse(
      formDataToObject(fd({ ...validQuote, vehicleYear: "", vehicleMake: "", vehicleModel: " ", serviceAddress: "" })),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.vehicleYear).toBeDefined();
      expect(errs.vehicleMake).toBeDefined();
      expect(errs.vehicleModel).toBeDefined();
      expect(errs.serviceAddress).toBeDefined();
    }
  });
  it("rejects past preferred dates (Eastern)", () => {
    const yesterday = addDays(todayEastern(), -1);
    const r = quoteRequestSchema.safeParse(formDataToObject(fd({ ...validQuote, preferredDate: yesterday })));
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).preferredDate).toBeDefined();
  });
  it("rejects date preferences in PRELAUNCH mode without a launch date", () => {
    // Default test env: PRELAUNCH, no NEXT_PUBLIC_LAUNCH_DATE.
    const future = addDays(todayEastern(), 30);
    const r = quoteRequestSchema.safeParse(formDataToObject(fd({ ...validQuote, preferredDate: future })));
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).preferredDate).toMatch(/opening date/i);
  });
  it("rejects unknown enum values and bad years", () => {
    const r = quoteRequestSchema.safeParse(formDataToObject(fd({ ...validQuote, serviceId: "ppf", vehicleYear: "1899" })));
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.serviceId).toBeDefined();
      expect(errs.vehicleYear).toBeDefined();
    }
  });
  it("strips control characters from free text", () => {
    const r = quoteRequestSchema.safeParse(formDataToObject(fd({ ...validQuote, notes: "hello\u0000\u0007 world" })));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe("hello world");
  });
});
