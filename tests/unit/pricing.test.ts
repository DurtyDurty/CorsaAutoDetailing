import { describe, expect, it } from "vitest";
import { business, getService } from "@/config/business";
import { computeEstimate, formatServicePrice, groupStartingPrice, sizePrices } from "@/lib/pricing";

describe("computeEstimate", () => {
  it("returns each package's one starting price", () => {
    const expected: Record<string, number> = {
      "basic-full": 90,
      "signature-full": 150,
      "platinum-full": 175,
      "monthly-maintenance": 150,
      "signature-interior": 125,
      "full-works-interior": 225,

      "signature-exterior": 125,
      "wax-and-buff": 200,
    };
    expect(business.services.map((s) => s.id)).toEqual(Object.keys(expected));
    for (const service of business.services) {
      const e = computeEstimate({ serviceId: service.id });
      expect(e?.basePrice, service.id).toBe(expected[service.id]);
      expect(e?.total).toBe(expected[service.id]);
      expect(e?.requiresCustomQuote).toBe(false);
      expect(e?.vehicleCategoryLabel).toBeNull();
    }
  });

  it("gives every group at least one package and links 'Everything in' to a real package", () => {
    for (const g of business.packageGroups) {
      expect(business.services.filter((s) => s.group === g.id).length, g.id).toBeGreaterThan(0);
    }
    const ids = business.services.map((s) => s.id as string);
    for (const s of business.services) {
      if (s.includesEverythingIn) expect(ids).toContain(s.includesEverythingIn);
    }
  });

  it("never changes the price for vehicle size, condition answers or flags", () => {
    const base = computeEstimate({ serviceId: "platinum-full" });
    const worse = computeEstimate({
      serviceId: "platinum-full",
      vehicleCategoryId: "large",
      condition: "deeper",
      conditionFlags: ["pet_hair", "sand", "stains", "odor", "mud"],
    });
    expect(worse?.total).toBe(base?.total);
    expect(worse?.vehicleCategoryLabel).toBe("Pickup truck or three-row SUV");
    expect(worse?.reviewNotes.length).toBeGreaterThan(0);
  });

  it("ignores unknown add-ons and unknown flags", () => {
    const e = computeEstimate({
      serviceId: "signature-full",
      addOnIds: ["does-not-exist"],
      conditionFlags: ["bogus"],
    });
    expect(e?.addOns).toEqual([]);
    expect(e?.total).toBe(150);
  });

  it("prices the full packages per vehicle size and leaves the others at one price", () => {
    const ladder = (id: string) => sizePrices(getService(id)!)?.map((p) => `${p.size} ${p.price}`);
    expect(ladder("basic-full")).toEqual(["Sedan 90", "SUV 105", "Truck 120"]);
    expect(ladder("signature-full")).toEqual(["Sedan 150", "SUV 170", "Truck 190"]);
    expect(ladder("platinum-full")).toEqual(["Sedan 175", "SUV 200", "Truck 225"]);
    expect(sizePrices(getService("signature-interior")!)).toBeNull();
    expect(sizePrices(getService("monthly-maintenance")!)).toBeNull();
  });

  it("returns null for an unknown service", () => {
    expect(computeEstimate({ serviceId: "nope" })).toBeNull();
    expect(computeEstimate({ serviceId: "essential" })).toBeNull();
  });

  it("marks monthly packages and formats their price per month", () => {
    expect(computeEstimate({ serviceId: "monthly-maintenance" })?.billing).toBe("monthly");
    expect(computeEstimate({ serviceId: "wax-and-buff" })?.billing).toBe("visit");
    expect(formatServicePrice({ price: 150, billing: "monthly" })).toBe("$150/mo");
    expect(formatServicePrice({ price: 799, billing: "visit" })).toBe("$799");
  });

  it("snapshots the pricing version and notices", () => {
    const e = computeEstimate({ serviceId: "signature-full" });
    expect(e?.pricingVersion).toBe(business.pricingVersion);
    expect(e?.taxNotice).toBe(business.taxNotice);
    expect(groupStartingPrice("popular")).toBe(90); // monthly price excluded
    expect(groupStartingPrice("interior")).toBe(125);
    expect(groupStartingPrice("exterior")).toBe(125);
  });
});
