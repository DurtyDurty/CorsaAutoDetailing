import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { business } from "@/config/business";
import { computeAvailability, isSlotAvailable } from "@/lib/availability";
import { easternToUtc } from "@/lib/time";

// Wednesday, Oct 21 2026, 3:00 PM Eastern.
const NOW = easternToUtc("2026-10-21", "15:00");
const at = (date: string, time: string) => easternToUtc(date, time).toISOString();
const ARRIVALS = [...business.booking.arrivalWindows];

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
    expect(days[0].date).toBe("2026-10-22"); // tomorrow, not today
    expect(days.at(-1)!.date <= "2026-11-20").toBe(true);
    const sundays = days.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0);
    expect(sundays).toHaveLength(0);
  });

  it("offers a morning and an afternoon arrival, nothing in between", () => {
    const [first] = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    expect(first.slots).toEqual([at("2026-10-22", "08:00"), at("2026-10-22", "13:00")]);
    // A 5-hour job still fits the afternoon: 1:00-6:00 PM.
    const [sig] = computeAvailability({ serviceId: "platinum-full", busy: [], now: NOW });
    expect(sig.slots).toEqual([at("2026-10-22", "08:00"), at("2026-10-22", "13:00")]);
  });

  it("a long morning job closes the afternoon; a short one leaves it open", () => {
    // 5h morning job 8:00-13:00, plus 45 min travel: busy until 13:45.
    const long = [{ start: at("2026-10-22", "08:00"), busyUntil: at("2026-10-22", "13:45") }];
    expect(computeAvailability({ serviceId: "signature-full", busy: long, now: NOW })[0]!.slots).toEqual([]);
    // 3h morning job 8:00-11:00, plus travel: busy until 11:45.
    const short = [{ start: at("2026-10-22", "08:00"), busyUntil: at("2026-10-22", "11:45") }];
    expect(computeAvailability({ serviceId: "platinum-full", busy: short, now: NOW })[0]!.slots).toEqual([at("2026-10-22", "13:00")]);
  });

  it("a job the owner booked mid-day blocks whichever visits it touches", () => {
    // Owner's own job 10:00-12:00, busy until 12:45: the 8:00 visit would overlap, 1:00 PM is clear.
    const busy = [{ start: at("2026-10-22", "10:00"), busyUntil: at("2026-10-22", "12:45") }];
    expect(computeAvailability({ serviceId: "signature-full", busy, now: NOW })[0]!.slots).toEqual([at("2026-10-22", "13:00")]);
  });

  it("marks a fully booked day as having no slots rather than dropping it", () => {
    const busy = [{ start: at("2026-10-22", "08:00"), busyUntil: at("2026-10-22", "18:45") }];
    const [day] = computeAvailability({ serviceId: "signature-full", busy, now: NOW });
    expect(day.date).toBe("2026-10-22");
    expect(day.slots).toEqual([]);
  });

  it("leaves the owner's days off out of the calendar entirely", () => {
    const days = computeAvailability({ serviceId: "signature-full", busy: [], daysOff: ["2026-10-23"], now: NOW });
    expect(days.map((d) => d.date)).not.toContain("2026-10-23");
    expect(days.map((d) => d.date)).toContain("2026-10-22");
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

  it("re-checks a single slot server-side, and only accepts the offered arrival times", () => {
    const startIso = at("2026-10-22", "08:00");
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso })).toBe(true);
    const busy = [{ start: at("2026-10-22", "08:00"), busyUntil: at("2026-10-22", "11:45") }];
    expect(isSlotAvailable({ serviceId: "signature-full", busy, now: NOW, startIso })).toBe(false);
    // Free but not an arrival time: refused, so a crafted request can't book 9:30.
    expect(isSlotAvailable({ serviceId: "signature-full", busy: [], now: NOW, startIso: at("2026-10-22", "09:30") })).toBe(false);
  });

  it("falls back to every 30 minutes when no arrival windows are set", () => {
    business.booking.arrivalWindows.splice(0, Infinity);
    const [first] = computeAvailability({ serviceId: "signature-full", busy: [], now: NOW });
    // A 3h job: 8:00 ... 15:00, every 30 min.
    expect(first.slots).toHaveLength(15);
    expect(first.slots.at(-1)).toBe(at("2026-10-22", "15:00"));
  });
});
