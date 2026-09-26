import { business } from "@/config/business";

const TZ = business.timeZone;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Break a Date into wall-clock parts in the business time zone. */
export function easternParts(date: Date = new Date()): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAYS.indexOf(map.weekday),
  };
}

/** Today's date in Eastern time as YYYY-MM-DD. */
export function todayEastern(now: Date = new Date()): string {
  const p = easternParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** True if the YYYY-MM-DD date is before today's date in Eastern time. */
export function isPastEasternDate(value: string, now: Date = new Date()): boolean {
  return value < todayEastern(now);
}

/**
 * Earliest date a customer may express a preference for. Tomorrow in Eastern
 * time, or the configured launch date if that is later. `null` while no launch
 * date is configured in PRELAUNCH mode — preferences then use windows only.
 */
export function earliestPreferenceDate(now: Date = new Date()): string | null {
  if (business.mode === "PRELAUNCH" && !business.launchDate) return null;
  const tomorrow = addDays(todayEastern(now), 1);
  if (business.launchDate && business.launchDate > tomorrow) return business.launchDate;
  return tomorrow;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Format an ISO timestamp for display in Eastern time. */
export function formatEastern(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(date);
}

export function formatEasternDate(iso: string): string {
  // Interpret YYYY-MM-DD as a calendar date, not midnight UTC.
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Convert a local Eastern wall-clock date/time (YYYY-MM-DD, HH:MM) to a UTC
 * Date, handling DST by iterating on the offset.
 */
export function easternToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Start with a UTC guess, then correct by the zone offset observed at that instant.
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let i = 0; i < 2; i++) {
    const p = easternParts(guess);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = Date.UTC(y, m - 1, d, hh, mm) - asUtc;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

export interface Interval {
  start: Date;
  end: Date;
}

/** True when two intervals overlap once `bufferMinutes` is added around the first. */
export function overlapsWithBuffer(a: Interval, b: Interval, bufferMinutes: number): boolean {
  const buffer = bufferMinutes * 60_000;
  const aStart = a.start.getTime() - buffer;
  const aEnd = a.end.getTime() + buffer;
  return aStart < b.end.getTime() && b.start.getTime() < aEnd;
}

/** True when the Eastern wall-clock start and end fall inside configured work hours and days. */
export function withinWorkHours(start: Date, end: Date): { ok: boolean; reason?: string } {
  const s = easternParts(start);
  const e = easternParts(end);
  const { workHours, workDays } = business.scheduling;
  if (!(workDays as readonly number[]).includes(s.weekday)) {
    return { ok: false, reason: `${WEEKDAYS[s.weekday]} is outside configured work days.` };
  }
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = s.hour * 60 + s.minute;
  const endMin = e.hour * 60 + e.minute;
  const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
  if (!sameDay) return { ok: false, reason: "Appointments must start and end on the same day." };
  if (startMin < toMin(workHours.start) || endMin > toMin(workHours.end)) {
    return { ok: false, reason: `Outside work hours (${workHours.start}–${workHours.end} ET).` };
  }
  return { ok: true };
}
