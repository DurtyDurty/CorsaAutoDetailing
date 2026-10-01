import "server-only";
import type { AppointmentSummary } from "@shared/api";
import type { AppointmentStatus } from "@shared/appointment-status";
import { isGoogleAds } from "@/lib/attribution";
import type { LeadRecord, LeadStore } from "@/lib/leads/types";
import { addDays, easternToUtc, todayEastern } from "@/lib/time";
import { summarize } from "./appointments";

/**
 * Business analytics for the owner dashboard, computed from the same records
 * the app and website use. All dates are Eastern; weeks start Monday.
 */

export type AnalyticsRange = "30d" | "90d" | "year";

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

/** On the calendar and not called off. Held (waiting for confirmation) isn't booked yet. */
const BOOKED: readonly AppointmentStatus[] = ["confirmed", "en_route", "arrived", "in_progress", "completed"];
const LOST: readonly AppointmentStatus[] = ["cancelled", "no_show", "declined"];

export interface Metric {
  value: number;
  /** Same metric over the previous period of equal length; null when there is no previous period. */
  previous: number | null;
}

export interface SeriesPoint {
  label: string;
  /** Long form for tooltips and the table, e.g. "Week of Oct 5". */
  title: string;
  valueCents: number;
  jobs: number;
  current: boolean;
}

export interface CountRow {
  label: string;
  count: number;
  /** Booked revenue for this row, when it applies. */
  cents?: number;
}

export interface Analytics {
  range: AnalyticsRange;
  periodLabel: string;
  bookedCents: Metric;
  collectedCents: Metric;
  completedJobs: Metric;
  avgTicketCents: Metric;
  /** Share of booking requests in the period that became a booking (0-1); null with no requests. */
  conversion: { rate: number | null; previous: number | null; requests: number; booked: number };
  /** Cancelled / no-show / declined share of jobs in the period (0-1); null with no jobs. */
  lostRate: { rate: number | null; lost: number; total: number };
  next7: { cents: number; jobs: number };
  series: { unit: "week" | "month"; points: SeriesPoint[] };
  funnel: CountRow[];
  services: CountRow[];
  sources: CountRow[];
  /**
   * Customers who first came from a Google ad and sent a request in the period
   * (a cohort by request date), and how far they got. Actual records only;
   * spend comes from Google Ads separately.
   */
  googleAds: { leads: number; bookings: number; payingCustomers: number; revenueCents: number; from: string; to: string };
}

const day = (iso: string) => todayEastern(new Date(iso));
const startOf = (d: string) => easternToUtc(d, "00:00").toISOString();

function weekdayOf(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
}
const mondayOf = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7));

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const asUtc = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};

function periodBounds(range: AnalyticsRange, now: Date) {
  const today = todayEastern(now);
  if (range === "year") {
    const start = `${today.slice(0, 4)}-01-01`;
    const prevStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
    // The previous period is the same stretch of last year (Jan 1 to the same date).
    const prevEnd = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
    return { start, end: addDays(today, 1), prevStart, prevEnd: addDays(prevEnd, 1) };
  }
  const days = range === "30d" ? 30 : 90;
  const start = addDays(today, -(days - 1));
  return { start, end: addDays(today, 1), prevStart: addDays(start, -days), prevEnd: start };
}

/** Where a request came from, in plain words. */
export function sourceLabel(l: Pick<LeadRecord, "source">): string {
  const s = l.source;
  if (s.landingPath === "owner-app") return "Booked in the app";
  if (s.landingPath === "email-reply") return "Emailed in";
  if (isGoogleAds(s)) return "Google Ads";
  const utm = s.utmSource?.toLowerCase();
  // Stored as a host ("www.google.com"); very old rows may hold a full URL.
  const ref = (() => {
    if (!s.referrer) return null;
    try {
      return new URL(s.referrer.includes("://") ? s.referrer : `https://${s.referrer}`).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  const hint = utm ?? ref ?? "";
  if (/google/.test(hint)) return "Google";
  if (/bing|duckduckgo|yahoo/.test(hint)) return "Other search";
  if (/facebook|instagram|fb\.|^ig$|meta/.test(hint)) return "Facebook / Instagram";
  if (/nextdoor/.test(hint)) return "Nextdoor";
  if (hint && !/corsaautodetailing/.test(hint)) return utm ? `Campaign: ${utm}` : ref!;
  return "Direct / typed in";
}

function tally(rows: string[], cap = 6): CountRow[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r, (m.get(r) ?? 0) + 1);
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length <= cap) return sorted.map(([label, count]) => ({ label, count }));
  const head = sorted.slice(0, cap - 1).map(([label, count]) => ({ label, count }));
  const other = sorted.slice(cap - 1).reduce((n, [, c]) => n + c, 0);
  return [...head, { label: "Other", count: other }];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function windowStats(items: AppointmentSummary[], fromIso: string, toIso: string) {
  const inWindow = items.filter((a) => a.startsAt >= fromIso && a.startsAt < toIso);
  const booked = inWindow.filter((a) => BOOKED.includes(a.status));
  const completed = inWindow.filter((a) => a.status === "completed");
  const collected = sum(inWindow.map((a) => a.balance.collectedCents));
  return {
    inWindow,
    booked,
    bookedCents: sum(booked.map((a) => a.balance.totalCents)),
    collectedCents: collected,
    completed: completed.length,
    avgTicketCents: completed.length ? Math.round(sum(completed.map((a) => a.balance.totalCents)) / completed.length) : 0,
    lost: inWindow.filter((a) => LOST.includes(a.status)).length,
  };
}

export async function computeAnalytics(store: LeadStore, range: AnalyticsRange, now: Date = new Date()): Promise<Analytics> {
  const { start, end, prevStart, prevEnd } = periodBounds(range, now);
  const today = todayEastern(now);
  const fromIso = startOf(start);
  const toIso = startOf(end);
  const prevFromIso = startOf(prevStart);
  const prevToIso = startOf(prevEnd);
  const next7Iso = startOf(addDays(today, 8));

  const [appts, leads] = await Promise.all([
    store.listAppointments({ from: prevFromIso, to: next7Iso }),
    store.listLeads({ includeArchived: true, limit: 5000 }),
  ]);
  const items = await summarize(store, appts);

  const cur = windowStats(items, fromIso, toIso);
  const prev = windowStats(items, prevFromIso, prevToIso);
  const hasPrev = range !== "year" || items.some((a) => a.startsAt < fromIso) || leads.some((l) => l.createdAt < fromIso);
  const metric = (value: number, previous: number): Metric => ({ value, previous: hasPrev ? previous : null });

  // Conversion: booking requests created in the period that got a booking (at any time).
  const bookedLeadIds = new Set(items.filter((a) => BOOKED.includes(a.status)).map((a) => a.leadId));
  const requestsIn = (a: string, b: string) => leads.filter((l) => l.leadType === "quote_request" && l.createdAt >= a && l.createdAt < b);
  const reqNow = requestsIn(fromIso, toIso);
  const reqPrev = requestsIn(prevFromIso, prevToIso);
  const convertedNow = reqNow.filter((l) => bookedLeadIds.has(l.id)).length;
  const convertedPrev = reqPrev.filter((l) => bookedLeadIds.has(l.id)).length;

  // Revenue over time: weeks for 30/90 days, months for the year.
  const unit = range === "year" ? "month" : "week";
  const points: SeriesPoint[] = [];
  if (unit === "week") {
    for (let w = mondayOf(start); w < end; w = addDays(w, 7)) {
      const s = cur.booked.filter((a) => day(a.startsAt) >= w && day(a.startsAt) < addDays(w, 7));
      points.push({
        label: dayName.format(asUtc(w)),
        title: `Week of ${dayName.format(asUtc(w))}`,
        valueCents: sum(s.map((a) => a.balance.totalCents)),
        jobs: s.length,
        current: w === mondayOf(today),
      });
    }
  } else {
    const year = today.slice(0, 4);
    for (let m = 1; m <= Number(today.slice(5, 7)); m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const s = cur.booked.filter((a) => day(a.startsAt).startsWith(key));
      points.push({
        label: monthName.format(asUtc(`${key}-01`)),
        title: monthName.format(asUtc(`${key}-01`)) + ` ${year}`,
        valueCents: sum(s.map((a) => a.balance.totalCents)),
        jobs: s.length,
        current: m === Number(today.slice(5, 7)),
      });
    }
  }

  const leadsNow = leads.filter((l) => l.createdAt >= fromIso && l.createdAt < toIso && l.leadType !== "launch_list");
  const serviceRows = new Map<string, CountRow>();
  for (const a of cur.booked) {
    const key = a.serviceName ?? "Not set";
    const row = serviceRows.get(key) ?? { label: key, count: 0, cents: 0 };
    row.count += 1;
    row.cents = (row.cents ?? 0) + a.balance.totalCents;
    serviceRows.set(key, row);
  }

  const adLeads = leadsNow.filter((l) => isGoogleAds(l.source) && l.stage !== "spam");
  const adJobs = (id: string) => items.filter((a) => a.leadId === id);
  const adPaid = adLeads.filter((l) => adJobs(l.id).some((a) => a.balance.collectedCents > 0));

  const next7 = items.filter((a) => BOOKED.includes(a.status) && a.status !== "completed" && day(a.startsAt) >= today && a.startsAt < next7Iso);

  return {
    range,
    periodLabel: RANGE_LABELS[range],
    bookedCents: metric(cur.bookedCents, prev.bookedCents),
    collectedCents: metric(cur.collectedCents, prev.collectedCents),
    completedJobs: metric(cur.completed, prev.completed),
    avgTicketCents: metric(cur.avgTicketCents, prev.avgTicketCents),
    conversion: {
      rate: reqNow.length ? convertedNow / reqNow.length : null,
      previous: hasPrev && reqPrev.length ? convertedPrev / reqPrev.length : null,
      requests: reqNow.length,
      booked: convertedNow,
    },
    lostRate: {
      rate: cur.booked.length + cur.lost ? cur.lost / (cur.booked.length + cur.lost) : null,
      lost: cur.lost,
      total: cur.booked.length + cur.lost,
    },
    next7: { cents: sum(next7.map((a) => a.balance.totalCents)), jobs: next7.length },
    series: { unit, points },
    funnel: [
      { label: "Requests", count: reqNow.length },
      { label: "Booked", count: convertedNow },
      { label: "Completed", count: reqNow.filter((l) => items.some((a) => a.leadId === l.id && a.status === "completed")).length },
    ],
    services: [...serviceRows.values()].sort((a, b) => b.count - a.count || (b.cents ?? 0) - (a.cents ?? 0)),
    sources: tally(leadsNow.map(sourceLabel)),
    googleAds: {
      leads: adLeads.length,
      bookings: adLeads.filter((l) => adJobs(l.id).some((a) => BOOKED.includes(a.status))).length,
      payingCustomers: adPaid.length,
      revenueCents: sum(adPaid.flatMap((l) => adJobs(l.id).map((a) => a.balance.collectedCents))),
      from: start,
      to: today,
    },
  };
}
