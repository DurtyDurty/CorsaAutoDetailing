import "server-only";
import type { AppointmentSummary, TodaySummary } from "@shared/api";
import { FIELD_STATUSES, type AppointmentStatus } from "@shared/appointment-status";
import type { LeadStore } from "@/lib/leads/types";
import { addDays, easternToUtc, todayEastern } from "@/lib/time";
import { summarize } from "./appointments";

/** Booked = on the calendar and not called off. Held (deposit pending) isn't booked yet. */
const BOOKED: readonly AppointmentStatus[] = ["confirmed", "en_route", "arrived", "in_progress", "completed"];
const HIDDEN_FROM_TIMELINE: readonly AppointmentStatus[] = ["cancelled", "declined"];

const startOf = (day: string) => easternToUtc(day, "00:00").toISOString();

function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function bookedTotal(items: AppointmentSummary[], fromIso: string, toIso: string) {
  const inRange = items.filter((a) => BOOKED.includes(a.status) && a.startsAt >= fromIso && a.startsAt < toIso);
  return { jobs: inRange.length, bookedCents: inRange.reduce((n, a) => n + a.balance.totalCents, 0) };
}

/** Everything the Today screen shows, computed in Eastern time (weeks start Monday). */
export async function todaySummary(store: LeadStore, now: Date = new Date()): Promise<TodaySummary> {
  const today = todayEastern(now);
  const weekStartDay = addDays(today, -((weekdayOf(today) + 6) % 7));
  const monthStartDay = `${today.slice(0, 8)}01`;
  const nextMonthDay = (() => {
    const [y, m] = today.split("-").map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  })();

  const dayStart = startOf(today);
  const dayEnd = startOf(addDays(today, 1));
  const weekStart = startOf(weekStartDay);
  const weekEnd = startOf(addDays(weekStartDay, 7));
  const monthStart = startOf(monthStartDay);
  const monthEnd = startOf(nextMonthDay);
  // Wide enough for this week, this month, and the next job even if it's a few weeks out.
  const rangeFrom = weekStart < monthStart ? weekStart : monthStart;
  const horizon = startOf(addDays(today, 60));
  const rangeTo = [weekEnd, monthEnd, horizon].sort().at(-1)!;

  // Expired holds stop counting as "to confirm" and free their times.
  await store.releaseExpiredHolds();
  const [appts, requests, messages] = await Promise.all([
    store.listAppointments({ from: rangeFrom, to: rangeTo }),
    store.listLeads({ leadType: "quote_request", stage: "new" }),
    store.listLeads({ leadType: "contact", stage: "new" }),
  ]);
  const items = await summarize(store, appts);
  const nowIso = now.toISOString();

  const todays = items.filter((a) => a.startsAt >= dayStart && a.startsAt < dayEnd);
  const todaysBooked = todays.filter((a) => BOOKED.includes(a.status));
  const timeline = todays
    .filter((a) => !HIDDEN_FROM_TIMELINE.includes(a.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const underway = items.find((a) => FIELD_STATUSES.includes(a.status));
  const next = items
    .filter((a) => a.status === "confirmed" && a.endsAt >= nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const toConfirm = items
    .filter((a) => a.status === "held" && a.depositStatus === "none" && a.endsAt >= nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return {
    date: today,
    generatedAt: nowIso,
    today: {
      jobs: todaysBooked.length,
      bookedCents: todaysBooked.reduce((n, a) => n + a.balance.totalCents, 0),
      depositsCollectedCents: todaysBooked.reduce((n, a) => n + a.balance.depositPaidCents, 0),
      collectedCents: todaysBooked.reduce((n, a) => n + a.balance.collectedCents, 0),
      outstandingCents: todaysBooked.reduce((n, a) => n + a.balance.balanceDueCents, 0),
    },
    week: bookedTotal(items, weekStart, weekEnd),
    month: bookedTotal(items, monthStart, monthEnd),
    newRequests: requests.length,
    unreadMessages: messages.length,
    awaitingConfirmation: toConfirm.length,
    focus: underway ?? next ?? null,
    toConfirm,
    timeline,
  };
}
