import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingWizardSchema, fieldErrors, formDataToObject } from "@/lib/validation";
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
  vehicleCategory: "suv2",
  vehicleYear: "2019",
  vehicleMake: "Toyota",
  vehicleModel: "RAV4",
  town: "middleburg",
  slotStart: "2026-11-02T14:30:00.000Z",
  dayPart: "morning",
};

const parse = (entries: Record<string, string>, f = fd(entries)) => bookingWizardSchema.safeParse(formDataToObject(f));

describe("bookingWizardSchema", () => {
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

  it("requires phone, name, town, vehicle size, package and a day", () => {
    const r = parse({ idempotencyKey: KEY, phone: "", name: "", vehicleYear: "2019", vehicleMake: "Kia", vehicleModel: "Soul" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(Object.keys(errs)).toEqual(expect.arrayContaining(["phone", "name", "town", "vehicleCategory", "serviceId", "slotStart", "dayPart"]));
      expect(errs.phone).toBe("Enter your phone number.");
      expect(errs.vehicleCategory).toBe("Choose your vehicle size.");
    }
    expect(parse({ ...valid, vehicleCategory: "boat" }).success).toBe(false);
    const ok = parse(valid);
    expect(ok.success && ok.data.vehicleCategory).toBe("suv2");
  });

  it("takes a second car with its own size, package and vehicle, and requires them once ticked", () => {
    const two = parse({ ...valid, secondCar: "on", car2Category: "large", car2ServiceId: "platinum-full", car2Year: "2022", car2Make: "Ford", car2Model: "F-150" });
    expect(two.success).toBe(true);
    if (two.success) expect(two.data).toMatchObject({ secondCar: true, car2Category: "large", car2ServiceId: "platinum-full", car2Make: "Ford", car2Model: "F-150" });
    // "Help me choose" works for the second car; Corsa Club doesn't.
    expect(parse({ ...valid, secondCar: "on", car2Category: "sedan", car2ServiceId: "help", car2Year: "2015", car2Make: "Kia", car2Model: "Soul" }).success).toBe(true);
    const missing = parse({ ...valid, secondCar: "on", car2ServiceId: "monthly-maintenance" });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(Object.keys(fieldErrors(missing.error))).toEqual(expect.arrayContaining(["car2Category", "car2ServiceId", "car2Year", "car2Make", "car2Model"]));
    // Not ticked: stray fields are ignored.
    const one = parse({ ...valid, car2ServiceId: "platinum-full" });
    expect(one.success && one.data.secondCar).toBe(false);
  });

  it("only accepts towns we list, or 'other' with a ZIP", () => {
    expect(parse({ ...valid, town: "other", zip: "32656" }).success).toBe(true);
    const noZip = parse({ ...valid, town: "other" });
    expect(noZip.success).toBe(false);
    if (!noZip.success) expect(fieldErrors(noZip.error).zip).toBe("Enter a 5-digit ZIP code.");
    expect(parse({ ...valid, town: "atlantis" }).success).toBe(false);
  });

  it("takes Help me choose, condition flags, the discounts and the page language", () => {
    const f = fd({ ...valid, serviceId: "help", military: "on", firstTimeOffer: "on", lang: "es" });
    f.append("conditionFlags", "pet_hair");
    f.append("conditionFlags", "bugs_tar");
    const r = parse({}, f);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ serviceId: "help", military: true, firstTimeOffer: true, lang: "es", conditionFlags: ["pet_hair", "bugs_tar"] });
    }
    expect(parse({ ...valid, conditionFlags: "made_up" }).success).toBe(false);
    const withAddOn = parse({ ...valid, addOns: "paint-enhancement" });
    expect(withAddOn.success && withAddOn.data.addOns).toEqual(["paint-enhancement"]);
    // Only the optional ones can be asked for on the form.
    expect(parse({ ...valid, addOns: "pet-hair" }).success).toBe(false);
    expect(parse(valid).success && parse(valid).data).toMatchObject({ military: false, lang: "en", conditionFlags: [] });
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
    expect(SMS_PREFILL).toBe("Hi Corsa, I'd like a quote for my car");
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
