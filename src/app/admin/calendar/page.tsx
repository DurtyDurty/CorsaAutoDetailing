import type { Metadata } from "next";
import Link from "next/link";
import { listAppointmentsQuery } from "@shared/api";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { listAppointmentSummaries } from "@/lib/owner/appointments";
import { addDays, easternToUtc, formatEastern, isIsoDate, todayEastern } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/work/StatusBadge";

export const metadata: Metadata = { title: "Calendar" };

const HIDDEN = new Set(["cancelled", "declined"]);
const utcNoon = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd, 12));
};
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "UTC" }).format(utcNoon(d));
const mondayOf = (d: string) => addDays(d, -((utcNoon(d).getUTCDay() + 6) % 7));
const time = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: "short" });

/** A week at a glance and one day's jobs, laid out like the app's Calendar tab. */
export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const today = todayEastern();
  const selected = typeof sp.day === "string" && isIsoDate(sp.day) ? sp.day : today;
  const weekStart = mondayOf(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const page = await listAppointmentSummaries(
    store,
    listAppointmentsQuery.parse({
      from: easternToUtc(weekStart, "00:00").toISOString(),
      to: easternToUtc(addDays(weekStart, 7), "00:00").toISOString(),
      limit: 200,
    }),
  );
  const byDay = new Map<string, typeof page.items>();
  for (const a of page.items) {
    if (HIDDEN.has(a.status)) continue;
    const k = todayEastern(new Date(a.startsAt));
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const jobs = byDay.get(selected) ?? [];
  const href = (d: string) => `/admin/calendar?day=${d}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">Calendar</h1>
        <ButtonLink href="/admin/book" variant="secondary" size="sm">
          + New appointment
        </ButtonLink>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={href(addDays(selected, -7))} className="px-3 py-1.5 border border-line bg-white rounded-sm" aria-label="Previous week">
          ‹
        </Link>
        <p className="font-medium">{fmt(selected, { month: "long", year: "numeric" })}</p>
        <div className="flex gap-2">
          {selected !== today && (
            <Link href={href(today)} className="px-3 py-1.5 border border-line bg-white rounded-sm text-sm">
              Today
            </Link>
          )}
          <Link href={href(addDays(selected, 7))} className="px-3 py-1.5 border border-line bg-white rounded-sm" aria-label="Next week">
            ›
          </Link>
        </div>
      </div>

      <nav aria-label="Days" className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const on = d === selected;
          const count = byDay.get(d)?.length ?? 0;
          return (
            <Link
              key={d}
              href={href(d)}
              aria-current={on ? "date" : undefined}
              aria-label={`${fmt(d, { weekday: "long", month: "long", day: "numeric" })}, ${count} ${count === 1 ? "job" : "jobs"}${d === today ? ", today" : ""}`}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-sm border py-2.5",
                on ? "bg-asphalt border-asphalt text-chalk" : "bg-white border-line hover:border-ink-muted",
              )}
            >
              <span className={cn("text-[0.65rem] uppercase tracking-[0.14em]", on ? "text-chalk/70" : "text-ink-muted")}>{fmt(d, { weekday: "short" })}</span>
              <span className={cn("font-display text-2xl leading-none", !on && d === today && "text-apex-deep")}>{fmt(d, { day: "numeric" })}</span>
              <span className={cn("text-[0.7rem]", on ? "text-chalk/80" : count ? "text-apex-deep font-semibold" : "text-transparent")}>
                {count ? `${count} ${count === 1 ? "job" : "jobs"}` : "·"}
              </span>
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <h2 id="day-title" className="text-xs uppercase tracking-[0.16em] text-ink-muted">
          {selected === today ? "Today" : fmt(selected, { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-ink-muted border border-dashed border-line rounded-md px-4 py-6 text-center">Nothing booked this day.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/jobs/${a.id}`}
                  className={cn(
                    "block border bg-white rounded-md p-4 hover:shadow-sm",
                    a.status === "held" ? "border-[#d9a441]" : "border-line border-l-[3px] border-l-apex-deep",
                  )}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {time(a.startsAt)} – {time(a.endsAt)}
                    </span>
                    <StatusBadge status={a.status} />
                  </span>
                  <span className="block font-medium mt-1">{a.customerName}</span>
                  <span className="block text-sm text-ink-muted">
                    {a.serviceName ?? "Service not set"}
                    {[a.vehicle.year, a.vehicle.make, a.vehicle.model].some(Boolean) && ` · ${[a.vehicle.year, a.vehicle.make, a.vehicle.model].filter(Boolean).join(" ")}`}
                  </span>
                  {a.status === "held" && <span className="block text-sm text-[#8a5a12] mt-1">To confirm: open to confirm or decline</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
