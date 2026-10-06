"use client";

import { useEffect, useId, useState } from "react";
import { business } from "@/config/business";
import { cn } from "@/lib/utils";

interface Day {
  date: string;
  slots: string[];
}

const TZ = business.timeZone;
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(dt),
    day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(dt),
  };
};
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
/** "08:00" for a slot, in Eastern time, to match it to an arrival window. */
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));
const WINDOWS = business.booking.arrivalWindows;

/** The arrival windows of a day, each with its slot when it's still open. */
function windowsOf(day: Day | undefined) {
  return WINDOWS.map((w) => ({ ...w, slot: day?.slots.find((s) => hhmm(s) === w.start) ?? null }));
}

/** "AM · PM", "AM only", "PM only" or "Full" for the day strip. */
function openLabel(day: Day): string {
  if (!WINDOWS.length) return day.slots.length ? `${day.slots.length} open` : "Full";
  const open = windowsOf(day).filter((w) => w.slot).map((w) => (w.id === "morning" ? "AM" : w.id === "afternoon" ? "PM" : w.label));
  return open.length === 0 ? "Full" : open.length === WINDOWS.length ? open.join(" · ") : `${open.join(" · ")} only`;
}

/**
 * Pick a day, then an open start time. The chosen slot is submitted as
 * `slotStart` (ISO) via a required radio group, so native validation blocks
 * "Continue" until a time is picked. Open times come from /api/availability.
 */
export function SlotPicker({ serviceId, required, error }: { serviceId: string; required: boolean; error?: string }) {
  const id = useId();
  // Keyed by service so switching packages refetches without a synchronous loading flag.
  const [data, setData] = useState<{ service: string; days: Day[] | null; failed: boolean } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    fetch(`/api/availability?service=${encodeURIComponent(serviceId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { days: Day[] }) => alive && setData({ service: serviceId, days: json.days, failed: false }))
      .catch(() => alive && setData({ service: serviceId, days: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [serviceId]);

  const current = data?.service === serviceId ? data : null;
  const days = current?.days ?? [];
  const firstOpen = days.find((d) => d.slots.length > 0)?.date ?? null;
  const activeDay = day && days.some((d) => d.date === day) ? day : firstOpen;
  const activeSlots = days.find((d) => d.date === activeDay)?.slots ?? [];
  const duration = business.booking.durationMinutes[serviceId as keyof typeof business.booking.durationMinutes] ?? business.scheduling.defaultDurationMinutes;

  if (!serviceId) return <p className="text-sm text-ink-muted">Choose a package first to see open times.</p>;
  if (!current) return <p className="text-sm text-ink-muted" aria-live="polite">Loading open times…</p>;
  if (current.failed)
    return (
      <p className="text-sm text-error" role="alert">
        We couldn&rsquo;t load open times. Please refresh the page and try again.
      </p>
    );
  if (!firstOpen)
    return (
      <p className="text-sm border border-line bg-white px-4 py-3">
        We&rsquo;re fully booked for the next {business.booking.maxDaysAhead} days. Please send us a message and we&rsquo;ll find a time.
      </p>
    );

  return (
    // min-w-0: fieldsets default to min-content width, which would let the scrolling day strip widen the page.
    <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={error ? `${id}-err` : undefined} data-field="slotStart">
      <legend className="text-sm font-medium mb-1.5">Choose a day</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Days">
        {/* The strip starts at the first day with an opening; full days before it would only push it out of view. */}
        {days.slice(days.findIndex((x) => x.date === firstOpen)).map((d) => {
          const { weekday, day: label } = dayLabel(d.date);
          const full = d.slots.length === 0;
          const selected = d.date === activeDay;
          return (
            <button
              key={d.date}
              type="button"
              disabled={full}
              aria-pressed={selected}
              onClick={() => {
                setDay(d.date);
                setSlot(null);
              }}
              className={cn(
                "flex min-w-[4.75rem] shrink-0 flex-col items-center gap-0.5 border px-3 py-2.5 text-sm transition-colors",
                selected ? "border-asphalt bg-asphalt text-chalk" : "border-line bg-white hover:border-ink-muted",
                full && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">{weekday}</span>
              <span className="font-semibold">{label}</span>
              <span className={cn("text-[0.7rem]", selected ? "text-chalk/70" : "text-ink-muted")}>
                {openLabel(d)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-medium" id={`${id}-times`}>
        {WINDOWS.length ? "Arrival" : "Start time"} <span className="font-normal text-ink-muted">(Eastern time)</span>
      </p>
      {WINDOWS.length > 0 ? (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby={`${id}-times`}>
          {windowsOf(days.find((d) => d.date === activeDay)).map((w) =>
            w.slot ? (
              <label
                key={w.id}
                className={cn("choice flex-col !items-start gap-0.5 px-4 py-3.5", slot === w.slot && "!border-asphalt bg-chalk")}
              >
                <input
                  type="radio"
                  name="slotStart"
                  value={w.slot}
                  required={required}
                  checked={slot === w.slot}
                  onChange={() => setSlot(w.slot)}
                  className="sr-only"
                />
                <span className="font-display text-xl leading-tight">{w.label}</span>
                <span className="text-sm font-medium">Arrive {timeLabel(w.slot)}</span>
                <span className="text-xs text-ink-muted">Done around {timeLabel(new Date(Date.parse(w.slot) + duration * 60_000).toISOString())}</span>
              </label>
            ) : (
              <div key={w.id} className="flex flex-col gap-0.5 border border-dashed border-line px-4 py-3.5 text-ink-muted" aria-disabled="true">
                <span className="font-display text-xl leading-tight">{w.label}</span>
                <span className="text-sm">Booked</span>
              </div>
            ),
          )}
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby={`${id}-times`}>
        {activeSlots.map((iso) => (
          <label key={iso} className={cn("choice justify-center py-2.5 text-sm font-medium", slot === iso && "!border-asphalt")}>
            <input
              type="radio"
              name="slotStart"
              value={iso}
              required={required}
              checked={slot === iso}
              onChange={() => setSlot(iso)}
              className="sr-only"
            />
            {timeLabel(iso)}
          </label>
        ))}
      </div>
      )}
      <p className="text-sm text-ink-muted">
        {WINDOWS.length
          ? "We take at most one morning and one afternoon visit a day, and block the whole service plus travel, so we're never rushed."
          : "Times are arrival times. Each visit is blocked for the full service plus travel, so we're never rushed."}
      </p>
      {error && (
        <p id={`${id}-err`} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
