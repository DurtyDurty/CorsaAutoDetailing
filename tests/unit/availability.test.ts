import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { business } from "@/config/business";
import { computeAvailability, isSlotAvailable } from "@/lib/availability";
import { easternToUtc } from "@/lib/time";

// Wednesday, Oct 21 2026, 3:00 PM Eastern.
const NOW = easternToUtc("2026-10-21", "15:00");
const at = (date: string, time: string) => easternToUtc(date, time).toISOString();
const times = (date: string, list: string[]) => list.map((t) => at(date, t));
const ARRIVALS = [...business.booking.arrivalWindows];
const D = "2026-10-22";
const MORNING = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"];
const AFTERNOON = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];

describe("computeAvailability", () => {
  // Give two packages a 3h and a 5h block for these tests (the real durations).
  beforeAll(() => {
    Object.assign(business.booking.durationMinutes, { "signature-full": 180, "platinum-full": 300 });
  });
  afterEach(() => {
    business.booking.arrivalWindows.splice(0, Infinity, ...ARRIVALS);
  });

  it("offers Mon-Sat only, from tomorrow up to 30 days out", () => {
    const days = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    expect(days[0].date).toBe(D); // tomorrow, not today
    expect(days.at(-1)!.date <= "2026-11-20").toBe(true);
    const sundays = days.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0);
    expect(sundays).toHaveLength(0);
  });

  it("offers preferred arrival times inside the morning and afternoon windows", () => {
    const [first] = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    expect(first.slots).toEqual(times(D, [...MORNING, ...AFTERNOON]));
    // A 5-hour job has to finish by 6 PM: the afternoon stops at 1:00.
    const [sig] = computeAvailability({ serviceId: "platinum-full", busy: [], now: NOW });
    expect(sig.slots).toEqual(times(D, [...MORNING, "12:00", "12:30", "13:00"]));
  });

  it("takes one visit per window: a morning visit closes the morning, and the afternoon starts after it", () => {
    // A 5h morning job 8:00-13:00 plus 45 min travel: busy until 13:45.
    const long = [{ start: at(D, "08:00"), busyUntil: at(D, "13:45") }];
    expect(computeAvailability({ serviceId: "signature-full", busy: long, now: NOW })[0]!.slots).toEqual(times(D, ["14:00", "14:30", "15:00"]));
    expect(computeAvailability({ serviceId: "platinum-full", busy: long, now: NOW })[0]!.slots).toEqual([]);
    // A 3h morning job at 9:30 is busy until 13:15: no other morning time, afternoon from 13:30.
    const short = [{ start: at(D, "09:30"), busyUntil: at(D, "13:15") }];
    expect(computeAvailability({ serviceId: "signature-full", busy: short, now: NOW })[0]!.slots).toEqual(times(D, ["13:30", "14:00", "14:30", "15:00"]));
  });

  it("an afternoon visit closes the afternoon but leaves the morning", () => {
    const busy = [{ start: at(D, "14:00"), busyUntil: at(D, "17:45") }];
    // Morning times must also finish (with travel) before 2:00 PM.
    expect(computeAvailability({ serviceId: "signature-full", busy, now: NOW })[0]!.slots).toEqual(times(D, ["08:00", "08:30", "09:00", "09:30", "10:00"]));
  });

  it("a job the owner booked in the morning takes the morning window", () => {
    const busy = [{ start: at(D, "10:00"), busyUntil: at(D, "12:45") }];
    expect(computeAvailability({ serviceId: "signature-full", busy, now: NOW })[0]!.slots).toEqual(times(D, ["13:00", "13:30", "14:00", "14:30", "15:00"]));
  });

  it("marks a fully booked day as having no slots rather than dropping it", () => {
    const busy = [{ start: at(D, "08:00"), busyUntil: at(D, "18:45") }];
    const [day] = computeAvailability({ serviceId: "signature-full", busy, now: NOW });
    expect(day.date).toBe(D);
    expect(day.slots).toEqual([]);
  });

  it("leaves the owner's days off out of the calendar entirely", () => {
    const days = computeAvailability({ serviceId: "signature-full", busy: [], daysOff: ["2026-10-23"], now: NOW });
    expect(days.map((d) => d.date)).not.toContain("2026-10-23");
    expect(days.map((d) => d.date)).toContain(D);
    const startIso = at("2026-10-23", "08:00");
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], daysOff: ["2026-10-23"], now: NOW, startIso })).toBe(false);
  });

  it("handles the Nov 1 daylight-saving change", () => {
    const days = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    const sat = days.find((d) => d.date === "2026-10-31")!;
    const mon = days.find((d) => d.date === "2026-11-02")!;
    expect(sat.slots[0]).toBe("2026-10-31T12:00:00.000Z"); // 8:00 EDT
    expect(mon.slots[0]).toBe("2026-11-02T13:00:00.000Z"); // 8:00 EST
  });

  it("re-checks a single time server-side, and only accepts times inside a window", () => {
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso: at(D, "09:30") })).toBe(true);
    const busy = [{ start: at(D, "08:00"), busyUntil: at(D, "11:45") }];
    // The morning is taken, even at a time that wouldn't overlap.
    expect(isSlotAvailable({ serviceId: "signature-full", busy, now: NOW, startIso: at(D, "11:00") })).toBe(false);
    // Off the half-hour grid, or between windows: refused, so a crafted request can't book them.
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso: at(D, "09:10") })).toBe(false);
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso: at(D, "11:30") })).toBe(false);
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso: at(D, "16:00") })).toBe(false);
  });

  it("falls back to every 30 minutes when no arrival windows are set", () => {
    business.booking.arrivalWindows.splice(0, Infinity);
    const [first] = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    // A 3h job: 8:00 ... 15:00, every 30 min.
    expect(first.slots).toHaveLength(15);
    expect(first.slots.at(-1)).toBe(at(D, "15:00"));
  });
});
