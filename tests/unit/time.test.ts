import { describe, expect, it } from "vitest";
import {
  easternParts,
  easternToUtc,
  isPastEasternDate,
  overlapsWithBuffer,
  todayEastern,
  withinWorkHours,
} from "@/lib/time";

describe("Eastern time helpers", () => {
  it("uses the Eastern calendar date, not UTC", () => {
    // 2026-03-10 03:30 UTC is 2026-03-09 23:30 EDT? No — DST starts Mar 8 2026, so it's 23:30 EDT on Mar 9.
    const late = new Date("2026-03-10T03:30:00Z");
    expect(todayEastern(late)).toBe("2026-03-09");
    // 2026-01-15 04:30 UTC is 2026-01-14 23:30 EST.
    expect(todayEastern(new Date("2026-01-15T04:30:00Z"))).toBe("2026-01-14");
  });

  it("rejects past dates relative to Eastern today", () => {
    const now = new Date("2026-06-01T02:00:00Z"); // 22:00 EDT May 31
    expect(isPastEasternDate("2026-05-30", now)).toBe(true);
    expect(isPastEasternDate("2026-05-31", now)).toBe(false);
    expect(isPastEasternDate("2026-06-01", now)).toBe(false);
  });

  it("converts Eastern wall-clock to UTC across DST", () => {
    const summer = easternToUtc("2026-07-01", "09:00"); // EDT = UTC-4
    expect(summer.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    const winter = easternToUtc("2026-12-01", "09:00"); // EST = UTC-5
    expect(winter.toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(easternParts(summer)).toMatchObject({ hour: 9, minute: 0, day: 1 });
  });

  it("detects overlaps including travel buffer", () => {
    const a = { start: new Date("2026-07-01T13:00:00Z"), end: new Date("2026-07-01T15:00:00Z") };
    const adjacent = { start: new Date("2026-07-01T15:30:00Z"), end: new Date("2026-07-01T17:00:00Z") };
    expect(overlapsWithBuffer(a, adjacent, 0)).toBe(false);
    expect(overlapsWithBuffer(a, adjacent, 45)).toBe(true);
    const later = { start: new Date("2026-07-01T16:00:00Z"), end: new Date("2026-07-01T17:00:00Z") };
    expect(overlapsWithBuffer(a, later, 45)).toBe(false);
  });

  it("enforces work hours and days in Eastern time", () => {
    const wedMorning = easternToUtc("2026-07-01", "08:00");
    expect(withinWorkHours(wedMorning, new Date(wedMorning.getTime() + 2 * 3600_000)).ok).toBe(true);
    const wedEvening = easternToUtc("2026-07-01", "17:00");
    expect(withinWorkHours(wedEvening, new Date(wedEvening.getTime() + 2 * 3600_000)).ok).toBe(false);
    const sunday = easternToUtc("2026-07-05", "10:00");
    expect(withinWorkHours(sunday, new Date(sunday.getTime() + 3600_000)).ok).toBe(false);
  });
});
