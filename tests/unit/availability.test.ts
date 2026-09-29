import { describe, expect, it } from "vitest";
import { computeAvailability, isSlotAvailable } from "@/lib/availability";
import { easternToUtc } from "@/lib/time";

// Wednesday, Oct 21 2026, 3:00 PM Eastern.
const NOW = easternToUtc("2026-10-21", "15:00");
const at = (date: string, time: string) => easternToUtc(date, time).toISOString();

describe("computeAvailability", () => {
  it("offers Mon-Sat only, from tomorrow up to 30 days out", () => {
    const days = computeAvailability({ serviceId: "essential", busy: [], now: NOW });
    expect(days[0].date).toBe("2026-10-22"); // tomorrow, not today
    expect(days.at(-1)!.date <= "2026-11-20").toBe(true);
    const sundays = days.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0);
    expect(sundays).toHaveLength(0);
  });

  it("fits each job inside 8am-6pm on a 30-minute grid", () => {
    const [first] = computeAvailability({ serviceId: "essential", busy: [], now: NOW });
    // Essential blocks 3h: 8:00 ... 15:00 → 15 start times.
    expect(first.slots).toHaveLength(15);
    expect(first.slots[0]).toBe(at("2026-10-22", "08:00"));
    expect(first.slots.at(-1)).toBe(at("2026-10-22", "15:00"));
    const [sig] = computeAvailability({ serviceId: "signature", busy: [], now: NOW });
    // Signature blocks 6h: 8:00 ... 12:00 → 9 start times.
    expect(sig.slots).toHaveLength(9);
    expect(sig.slots.at(-1)).toBe(at("2026-10-22", "12:00"));
  });

  it("keeps an existing job plus the 45-minute travel buffer free", () => {
    // Existing job 10:00-13:00 → busy until 13:45.
    const busy = [{ start: at("2026-10-22", "10:00"), busyUntil: at("2026-10-22", "13:45") }];
    const [day] = computeAvailability({ serviceId: "essential", busy, now: NOW });
    expect(day.slots).toEqual([at("2026-10-22", "14:00"), at("2026-10-22", "14:30"), at("2026-10-22", "15:00")]);
    // A new 3h job must also end 45 min before the existing one starts: 06:15 or earlier, so no morning slots.
    expect(day.slots).not.toContain(at("2026-10-22", "08:00"));
  });

  it("marks a fully booked day as having no slots rather than dropping it", () => {
    const busy = [{ start: at("2026-10-22", "08:00"), busyUntil: at("2026-10-22", "18:45") }];
    const [day] = computeAvailability({ serviceId: "essential", busy, now: NOW });
    expect(day.date).toBe("2026-10-22");
    expect(day.slots).toEqual([]);
  });

  it("handles the Nov 1 daylight-saving change", () => {
    const days = computeAvailability({ serviceId: "essential", busy: [], now: NOW });
    const sat = days.find((d) => d.date === "2026-10-31")!;
    const mon = days.find((d) => d.date === "2026-11-02")!;
    expect(sat.slots[0]).toBe("2026-10-31T12:00:00.000Z"); // 8:00 EDT
    expect(mon.slots[0]).toBe("2026-11-02T13:00:00.000Z"); // 8:00 EST
  });

  it("re-checks a single slot server-side", () => {
    const startIso = at("2026-10-22", "09:00");
    expect(isSlotAvailable({ serviceId: "essential", busy: [], now: NOW, startIso })).toBe(true);
    const busy = [{ start: at("2026-10-22", "09:00"), busyUntil: at("2026-10-22", "12:45") }];
    expect(isSlotAvailable({ serviceId: "essential", busy, now: NOW, startIso })).toBe(false);
    // Off-grid times are never accepted, even if free.
    expect(isSlotAvailable({ serviceId: "essential", busy: [], now: NOW, startIso: at("2026-10-22", "09:10") })).toBe(false);
  });
});
