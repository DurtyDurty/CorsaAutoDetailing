import { describe, expect, it } from "vitest";
import { business, getService } from "@/config/business";
import { computeEstimate, formatServicePrice, groupStartingPrice, recommendService, sizePrices } from "@/lib/pricing";

describe("computeEstimate", () => {
  it("returns each package's one starting price", () => {
    const expected: Record<string, number> = {
      "basic-full": 90,
      "signature-full": 150,
      "platinum-full": 200,
      "monthly-maintenance": 150,
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
    expect(ladder("platinum-full")).toEqual(["Sedan 200", "SUV 225", "Truck 250"]);
    expect(getService("signature-interior")).toBeUndefined();
    expect(sizePrices(getService("monthly-maintenance")!)).toBeNull();
  });

  it("recommends the highest package the checked needs call for", () => {
    const pick = (...ids: string[]) => {
      const r = recommendService(ids);
      return r && [r.service.id, r.followUp?.id ?? null];
    };
    expect(pick()).toBeNull();
    expect(pick("bogus")).toBeNull();
    expect(pick("quick-clean")).toEqual(["basic-full", null]);
    expect(pick("quick-clean", "wheels")).toEqual(["signature-full", null]);
    expect(pick("interior", "rough-paint")).toEqual(["platinum-full", null]);
    expect(pick("monthly")).toEqual(["monthly-maintenance", null]);
    expect(pick("monthly", "shine")).toEqual(["monthly-maintenance", null]);
    expect(pick("monthly", "deep-interior")).toEqual(["platinum-full", "monthly-maintenance"]);
    for (const n of business.packageNeeds) expect(getService(n.service), n.id).toBeDefined();
    // Ticked needs are saved with the estimate, in the customer's wording, and never change the price.
    const e = computeEstimate({ serviceId: "basic-full", needIds: ["rough-paint", "bogus"] });
    expect(e?.needs).toEqual(["Paint feels rough or gritty to the touch"]);
    expect(e?.total).toBe(90);
    expect(computeEstimate({ serviceId: "basic-full" })).not.toHaveProperty("needs");
  });

  it("returns null for an unknown service", () => {
    expect(computeEstimate({ serviceId: "nope" })).toBeNull();
    expect(computeEstimate({ serviceId: "essential" })).toBeNull();
  });

  it("marks monthly packages and formats their price per month", () => {
    expect(computeEstimate({ serviceId: "monthly-maintenance" })?.billing).toBe("monthly");
    expect(computeEstimate({ serviceId: "platinum-full" })?.billing).toBe("visit");
    expect(formatServicePrice({ price: 150, billing: "monthly" })).toBe("$150/mo");
    expect(formatServicePrice({ price: 799, billing: "visit" })).toBe("$799");
  });

  it("snapshots the pricing version and notices", () => {
    const e = computeEstimate({ serviceId: "signature-full" });
    expect(e?.pricingVersion).toBe(business.pricingVersion);
    expect(e?.taxNotice).toBe(business.taxNotice);
    expect(groupStartingPrice("popular")).toBe(90); // monthly price excluded
  });
});
