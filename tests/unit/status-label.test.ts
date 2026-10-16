import { describe, expect, it } from "vitest";
import { statusLabel } from "@shared/appointment-status";

describe("statusLabel", () => {
  it("says where a held job's quote stands", () => {
    expect(statusLabel("held", null)).toBe("Needs a quote");
    expect(statusLabel("held", "sent")).toBe("Quote sent · waiting on customer");
    expect(statusLabel("held", "expired")).toBe("Quote expired");
    expect(statusLabel("held", "declined")).toBe("Quote declined");
    expect(statusLabel("held", "withdrawn")).toBe("Needs a quote");
  });

  it("ignores the quote once the job is past held", () => {
    expect(statusLabel("confirmed", "accepted")).toBe("Confirmed");
  });
});
