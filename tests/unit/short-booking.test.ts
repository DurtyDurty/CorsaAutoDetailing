import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fieldErrors, formDataToObject, shortRequestSchema } from "@/lib/validation";
import { sourceLabel } from "@/lib/attribution";

const KEY = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const valid = {
  idempotencyKey: KEY,
  serviceId: "signature-full",
  name: " Ana Maria Ruiz ",
  phone: "(904) 555-0100",
  vehicleYear: "2019",
  vehicleMake: "Toyota",
  vehicleModel: "RAV4",
  town: "middleburg",
  slotStart: "2026-11-02T14:30:00.000Z",
  dayPart: "morning",
};

const parse = (entries: Record<string, string>) => shortRequestSchema.safeParse(formDataToObject(fd(entries)));

describe("shortRequestSchema", () => {
  it("accepts the essentials with no email", () => {
    const r = parse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBeNull();
      expect(r.data.phone).toBe("9045550100");
      expect(r.data.name).toBe("Ana Maria Ruiz");
      expect(r.data.vehicleYear).toBe(2019);
      expect(r.data.firstTimeOffer).toBe(false);
    }
  });

  it("treats a blank email as none and normalises a given one", () => {
    const blank = parse({ ...valid, email: "   " });
    expect(blank.success && blank.data.email).toBeNull();
    const given = parse({ ...valid, email: "Ana@Example.com" });
    expect(given.success && given.data.email).toBe("ana@example.com");
  });

  it("rejects a malformed email instead of dropping it", () => {
    const r = parse({ ...valid, email: "ana@" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toBeDefined();
  });

  it("requires phone, name, town, package and a day", () => {
    const r = parse({ idempotencyKey: KEY, phone: "", name: "", vehicleYear: "2019", vehicleMake: "Kia", vehicleModel: "Soul" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(Object.keys(errs)).toEqual(expect.arrayContaining(["phone", "name", "town", "serviceId", "slotStart", "dayPart"]));
      expect(errs.phone).toBe("Enter your phone number.");
    }
  });

  it("only accepts towns we list, or 'other'", () => {
    expect(parse({ ...valid, town: "other", townOther: "Keystone Heights" }).success).toBe(true);
    expect(parse({ ...valid, town: "atlantis" }).success).toBe(false);
  });

  it("refuses names that could carry a link", () => {
    expect(parse({ ...valid, name: "visit example.com" }).success).toBe(false);
  });
});

describe("phoneLink", () => {
  // business.ts reads the environment once, when it's first imported.
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("builds tel: and a prefilled sms: link from the configured number", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_PHONE", "904-649-0739");
    const { phoneLink, SMS_PREFILL } = await import("@/config/business");
    expect(phoneLink("tel")).toBe("tel:+19046490739");
    expect(phoneLink("sms", SMS_PREFILL)).toBe(`sms:+19046490739?&body=${encodeURIComponent(SMS_PREFILL)}`);
  });

  it("returns null with no phone configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_PHONE", "");
    const { phoneLink } = await import("@/config/business");
    expect(phoneLink("tel")).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("names where a lead came from", () => {
    expect(sourceLabel({ gclid: "Cj0KCQjw_abcdefghij" })).toBe("Google Ads");
    expect(sourceLabel({ utmSource: "google", utmMedium: "cpc" })).toBe("Google Ads");
    expect(sourceLabel({ utmSource: "facebook", utmMedium: "social" })).toBe("facebook / social");
    expect(sourceLabel({ referrer: "www.google.com" })).toBe("Google search");
    expect(sourceLabel({ referrer: "www.nextdoor.com" })).toBe("nextdoor.com");
    expect(sourceLabel({ landingPath: "owner-app" })).toBe("Owner app");
    expect(sourceLabel({})).toBe("Direct");
  });
});
