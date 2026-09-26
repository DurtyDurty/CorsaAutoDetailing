import { describe, expect, it } from "vitest";
import { lookupZip, isValidZip } from "@/lib/zip";

describe("lookupZip", () => {
  it("classifies core communities", () => {
    expect(lookupZip("32068")).toMatchObject({ eligibility: "core", community: "Middleburg" });
    expect(lookupZip("32003")).toMatchObject({ eligibility: "core", community: "Fleming Island" });
    expect(lookupZip("32043")).toMatchObject({ eligibility: "core", community: "Green Cove Springs" });
  });
  it("requires travel confirmation for Orange Park and other county ZIPs", () => {
    expect(lookupZip("32073")).toMatchObject({ eligibility: "confirm", community: "Orange Park" });
    expect(lookupZip("32656")).toMatchObject({ eligibility: "confirm", community: null });
  });
  it("marks everything else outside without blocking", () => {
    expect(lookupZip("32202").eligibility).toBe("outside");
    expect(lookupZip("32202").message).toMatch(/welcome to send/i);
  });
  it("validates format", () => {
    expect(isValidZip("32068")).toBe(true);
    expect(isValidZip("3206")).toBe(false);
    expect(isValidZip("abcde")).toBe(false);
  });
});
