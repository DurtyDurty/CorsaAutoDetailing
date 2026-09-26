import { describe, expect, it } from "vitest";
import { business } from "@/config/business";
import { computeEstimate, startingPrice } from "@/lib/pricing";

describe("computeEstimate", () => {
  it("returns the configured base price for every priced vehicle category", () => {
    const expected: Record<string, Record<string, number>> = {
      exterior: { sedan: 79, suv2: 89, large: 109 },
      maintenance: { sedan: 109, suv2: 129, large: 149 },
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

  it("requires a custom quote for unpriced categories", () => {
    for (const v of ["minivan", "oversized", "other"]) {
      const e = computeEstimate({ serviceId: "exterior", vehicleCategoryId: v });
      expect(e?.basePrice).toBeNull();
      expect(e?.total).toBeNull();
      expect(e?.requiresCustomQuote).toBe(true);
    }
  });

  it("never changes the price for condition answers or flags", () => {
    const base = computeEstimate({ serviceId: "maintenance", vehicleCategoryId: "suv2" });
    const worse = computeEstimate({
      serviceId: "maintenance",
      vehicleCategoryId: "suv2",
      condition: "deeper",
      conditionFlags: ["pet_hair", "sand", "stains", "odor", "mud"],
    });
    expect(worse?.total).toBe(base?.total);
    expect(worse?.reviewNotes.length).toBeGreaterThan(0);
  });

  it("ignores unknown add-ons and unknown flags", () => {
    const e = computeEstimate({
      serviceId: "exterior",
      vehicleCategoryId: "sedan",
      addOnIds: ["does-not-exist"],
      conditionFlags: ["bogus"],
    });
    expect(e?.addOns).toEqual([]);
    expect(e?.total).toBe(79);
  });

  it("returns null for unknown service or vehicle", () => {
    expect(computeEstimate({ serviceId: "nope", vehicleCategoryId: "sedan" })).toBeNull();
    expect(computeEstimate({ serviceId: "exterior", vehicleCategoryId: "nope" })).toBeNull();
  });

  it("snapshots the pricing version and notices", () => {
    const e = computeEstimate({ serviceId: "exterior", vehicleCategoryId: "sedan" });
    expect(e?.pricingVersion).toBe(business.pricingVersion);
    expect(e?.taxNotice).toBe(business.taxNotice);
    expect(startingPrice("exterior")).toBe(79);
  });
});
