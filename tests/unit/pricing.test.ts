import { describe, expect, it } from "vitest";
import { business } from "@/config/business";
import { computeEstimate, startingPrice } from "@/lib/pricing";

describe("computeEstimate", () => {
  it("returns the configured base price for every priced vehicle category", () => {
    const expected: Record<string, Record<string, number>> = {
      essential: { sedan: 140, suv2: 180, large: 220 },
      signature: { sedan: 275, suv2: 325, large: 375 },
    };
    for (const service of business.services) {
      for (const [vehicle, price] of Object.entries(expected[service.id])) {
        const e = computeEstimate({ serviceId: service.id, vehicleCategoryId: vehicle });
        expect(e?.basePrice, `${service.id}/${vehicle}`).toBe(price);
        expect(e?.total).toBe(price);
        expect(e?.requiresCustomQuote).toBe(false);
      }
    }
  });

  it("offers only the three priced vehicle sizes", () => {
    expect(business.vehicleCategories.map((v) => v.id)).toEqual(["sedan", "suv2", "large"]);
    expect(business.vehicleCategories.every((v) => v.priced)).toBe(true);
    for (const v of ["minivan", "oversized", "other"]) {
      expect(computeEstimate({ serviceId: "essential", vehicleCategoryId: v })).toBeNull();
    }
  });

  it("never changes the price for condition answers or flags", () => {
    const base = computeEstimate({ serviceId: "signature", vehicleCategoryId: "suv2" });
    const worse = computeEstimate({
      serviceId: "signature",
      vehicleCategoryId: "suv2",
      condition: "deeper",
      conditionFlags: ["pet_hair", "sand", "stains", "odor", "mud"],
    });
    expect(worse?.total).toBe(base?.total);
    expect(worse?.reviewNotes.length).toBeGreaterThan(0);
  });

  it("ignores unknown add-ons and unknown flags", () => {
    const e = computeEstimate({
      serviceId: "essential",
      vehicleCategoryId: "sedan",
      addOnIds: ["does-not-exist"],
      conditionFlags: ["bogus"],
    });
    expect(e?.addOns).toEqual([]);
    expect(e?.total).toBe(140);
  });

  it("returns null for unknown service or vehicle", () => {
    expect(computeEstimate({ serviceId: "nope", vehicleCategoryId: "sedan" })).toBeNull();
    expect(computeEstimate({ serviceId: "essential", vehicleCategoryId: "nope" })).toBeNull();
  });

  it("snapshots the pricing version and notices", () => {
    const e = computeEstimate({ serviceId: "essential", vehicleCategoryId: "sedan" });
    expect(e?.pricingVersion).toBe(business.pricingVersion);
    expect(e?.taxNotice).toBe(business.taxNotice);
    expect(startingPrice("essential")).toBe(140);
    expect(startingPrice("signature")).toBe(275);
  });
});
