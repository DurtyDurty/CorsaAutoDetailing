import { describe, expect, it } from "vitest";
import { availableTemplates } from "@shared/templates";

const fields = {
  firstName: "Ana",
  businessName: "Corsa Auto Detailing",
  serviceName: null,
  date: null,
  time: null,
  balance: null,
  offerPercent: 10,
  offerUrl: "https://example.com/request?offer=first-time",
};

describe("offer templates", () => {
  it("only appear for first-time offer signups", () => {
    const ids = (offer: boolean) => availableTemplates({ appointment: false, balance: false, offer }).map((t) => t.id);
    expect(ids(true)).toContain("offer_follow_up");
    expect(ids(false).filter((id) => id.startsWith("offer_"))).toEqual([]);
  });

  it("fill in the name, percent and booking link", () => {
    const offer = availableTemplates({ appointment: false, balance: false, offer: true }).filter((t) => t.needs.includes("offer"));
    for (const t of offer) {
      const text = `${t.subject(fields)}\n${t.body(fields)}`;
      expect(text).not.toMatch(/undefined|null|\$\{/);
      expect(t.body(fields)).toMatch(/^Hi Ana,/);
    }
    expect(offer.find((t) => t.id === "offer_follow_up")!.body(fields)).toBe("Hi Ana,\n\nThanks for signing up for 10% off your first detail.");
    expect(offer.find((t) => t.id === "offer_check_in")!.body(fields)).toContain(fields.offerUrl);
    expect(offer.find((t) => t.id === "offer_check_in")!.subject(fields)).toBe("Still want your 10% off?");
  });
});
