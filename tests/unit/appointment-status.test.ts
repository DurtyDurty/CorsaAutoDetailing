import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  BLOCKING_STATUSES,
  checkTransition,
  isBlocking,
  TERMINAL_STATUSES,
} from "@shared/appointment-status";
import { statusChangeSchema } from "@shared/api";

describe("appointment status rules", () => {
  it("walks the field workflow from confirmed to completed", () => {
    const path = ["confirmed", "en_route", "arrived", "in_progress", "completed"] as const;
    for (let i = 1; i < path.length; i++) {
      expect(checkTransition(path[i - 1], path[i]), `${path[i - 1]} → ${path[i]}`).toEqual({ ok: true, noop: false });
    }
  });

  it("treats asking for the current status as a harmless no-op", () => {
    for (const s of APPOINTMENT_STATUSES) expect(checkTransition(s, s)).toEqual({ ok: true, noop: true });
  });

  it("never reopens a finished appointment", () => {
    for (const from of TERMINAL_STATUSES) {
      expect(allowedTransitions(from)).toEqual([]);
      expect(checkTransition(from, "confirmed").ok).toBe(false);
    }
  });

  it("refuses skipping backwards or completing a job that hasn't started", () => {
    expect(checkTransition("in_progress", "confirmed").ok).toBe(false);
    expect(checkTransition("held", "completed").ok).toBe(false);
    expect(checkTransition("en_route", "completed").ok).toBe(false);
    const bad = checkTransition("completed", "cancelled");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toContain("Completed");
  });

  it("lets the owner undo an accidental en route", () => {
    expect(checkTransition("en_route", "confirmed")).toEqual({ ok: true, noop: false });
  });

  it("blocks calendar time only while a job is pending, booked or underway", () => {
    expect([...BLOCKING_STATUSES].sort()).toEqual(["arrived", "confirmed", "en_route", "held", "in_progress"]);
    expect(isBlocking("completed")).toBe(false);
    expect(isBlocking("cancelled")).toBe(false);
    expect(isBlocking("no_show")).toBe(false);
  });

  it("labels every status", () => {
    for (const s of APPOINTMENT_STATUSES) expect(APPOINTMENT_STATUS_LABELS[s].length).toBeGreaterThan(0);
  });
});

describe("status change input", () => {
  const requestId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  it("requires a reason and who cancelled", () => {
    const r = statusChangeSchema.safeParse({ to: "cancelled", requestId });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["cancelledBy", "reason"]);
    expect(statusChangeSchema.safeParse({ to: "cancelled", requestId, reason: "Rain", cancelledBy: "customer" }).success).toBe(true);
  });

  it("requires a reason for declines and no-shows, not for field steps", () => {
    expect(statusChangeSchema.safeParse({ to: "declined", requestId }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ to: "no_show", requestId }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ to: "en_route", requestId }).success).toBe(true);
  });

  it("rejects unknown statuses and missing request ids", () => {
    expect(statusChangeSchema.safeParse({ to: "paid", requestId }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ to: "arrived" }).success).toBe(false);
  });
});
