import { BUSINESS_TIME_ZONE } from "@/config";

const time = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, weekday: "long", month: "long", day: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
const hourOnly = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatTimeRange = (startIso: string, endIso: string) => `${formatTime(startIso)} – ${formatTime(endIso)}`;
export const formatLongDate = (d: Date) => longDate.format(d);
export const formatShortDay = (iso: string) => shortDay.format(new Date(iso));

/** Morning / afternoon / evening in Eastern time. */
export function greeting(now: Date = new Date()): string {
  const h = Number(hourOnly.format(now));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function vehicleLine(v: { year: number | null; make: string | null; model: string | null }): string | null {
  const s = [v.year, v.make, v.model].filter(Boolean).join(" ");
  return s || null;
}

export function addressLine(a: { serviceAddress: string | null; city: string | null; zip: string | null }): string | null {
  const s = [a.serviceAddress, a.city, a.zip].filter(Boolean).join(", ");
  return s || null;
}