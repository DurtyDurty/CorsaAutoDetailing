import { business, type ServiceId } from "@/config/business";
import { addDays, easternToUtc, todayEastern } from "@/lib/time";

/**
 * Online-booking availability. Pure: give it the busy windows and "now", get
 * back open start times. The database enforces the same rule on insert
 * (appointments_no_overlap), so this is what the customer sees and the
 * constraint is what actually guarantees no double booking.
 */

export interface BusyWindow {
  /** ISO start of an active (held or confirmed) appointment. */
  start: string;
  /** ISO end of that appointment's job plus its travel buffer. */
  busyUntil: string;
}

export interface AvailableDay {
  /** YYYY-MM-DD in Eastern time. */
  date: string;
  /** ISO timestamps (UTC) of open start times, earliest first. */
  slots: string[];
}

export interface AvailabilityInput {
  serviceId: ServiceId;
  busy: BusyWindow[];
  /** YYYY-MM-DD days the owner is off; these are left out entirely. */
  daysOff?: string[];
  now?: Date;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Weekday (0 = Sunday) of a YYYY-MM-DD calendar date. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The day's groups of start times: each arrival window with the part of the day
 * it occupies (from its start to the next window's start), or the whole day as
 * one group when no windows are set.
 */
function dayGroups(dayStart: number, dayEnd: number, interval: number): { times: number[]; occupies: [number, number] | null }[] {
  const steps = (from: number, to: number) => {
    const out: number[] = [];
    for (let t = from; t <= to; t += interval) out.push(t);
    return out;
  };
  const windows = [...business.booking.arrivalWindows].sort((a, b) => toMin(a.from) - toMin(b.from));
  if (!windows.length) return [{ times: steps(dayStart, dayEnd - interval), occupies: null }];
  return windows.map((w, i) => ({
    times: steps(Math.max(dayStart, toMin(w.from)), Math.min(dayEnd, toMin(w.to))),
    occupies: [i === 0 ? dayStart : toMin(w.from), i + 1 < windows.length ? toMin(windows[i + 1]!.from) : dayEnd],
  }));
}

/** First bookable calendar day: today + minDaysAhead, and never before the launch date. */
export function firstBookableDate(now: Date = new Date()): string {
  const first = addDays(todayEastern(now), business.booking.minDaysAhead);
  return business.launchDate && business.launchDate > first ? business.launchDate : first;
}

export function lastBookableDate(now: Date = new Date()): string {
  return addDays(todayEastern(now), business.booking.maxDaysAhead);
}

export function computeAvailability({ serviceId, busy, daysOff = [], now = new Date() }: AvailabilityInput): AvailableDay[] {
  const { workHours, workDays, travelBufferMinutes } = business.scheduling;
  const { slotIntervalMinutes } = business.booking;
  const duration = business.booking.durationMinutes[serviceId] ?? business.scheduling.defaultDurationMinutes;
  const dayStart = toMin(workHours.start);
  const dayEnd = toMin(workHours.end);
  const off = new Set(daysOff);
  const windows = busy.map((b) => ({ s: Date.parse(b.start), e: Date.parse(b.busyUntil) }));

  const days: AvailableDay[] = [];
  const last = lastBookableDate(now);
  for (let date = firstBookableDate(now); date <= last; date = addDays(date, 1)) {
    if (!(workDays as readonly number[]).includes(weekdayOf(date)) || off.has(date)) continue;
    const slots: string[] = [];
    for (const group of dayGroups(dayStart, dayEnd, slotIntervalMinutes)) {
      // One visit per window: anything already starting in it takes the whole window.
      if (group.occupies) {
        const from = easternToUtc(date, hhmm(group.occupies[0])).getTime();
        const to = easternToUtc(date, hhmm(group.occupies[1])).getTime();
        if (windows.some((w) => w.s >= from && w.s < to)) continue;
      }
      for (const t of group.times) {
        if (t + duration > dayEnd) continue;
        const start = easternToUtc(date, hhmm(t)).getTime();
        const end = start + duration * 60_000;
        const busyUntil = end + travelBufferMinutes * 60_000;
        if (start <= now.getTime()) continue;
        // Same test as the exclusion constraint: [start, busyUntil) must not touch any active window.
        if (windows.some((w) => w.s < busyUntil && start < w.e)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
    days.push({ date, slots });
  }
  return days;
}

/** True when `startIso` is one of the open slots right now (server-side re-check before holding). */
export function isSlotAvailable(input: AvailabilityInput & { startIso: string }): boolean {
  return computeAvailability(input).some((d) => d.slots.includes(input.startIso));
}
