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
/** "08:00" for a slot, in Eastern time, to match it to an arrival window. */
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));
const WINDOWS = business.booking.arrivalWindows;

/** Each window of a day with the first time still free in it (null when the window is taken). */
function partsOf(day: Day | undefined) {
  return WINDOWS.map((w) => ({ ...w, first: day?.slots.find((s) => hhmm(s) >= w.from && hhmm(s) <= w.to) ?? null }));
}

/**
 * Calendar requests: the customer picks a day and Morning, Afternoon or Either,
 * plus an optional preferred time. No times are shown; the owner sets the exact
 * time with the quote or by phone. Days and windows already taken can't be
 * picked. The hidden `slotStart` is a placeholder (the window's first free
 * time) that holds the window until the owner answers.
 */
export function DayPartPicker({ serviceId, required, error }: { serviceId: string; required: boolean; error?: string }) {
  const id = useId();
  const [data, setData] = useState<{ service: string; days: Day[] | null; failed: boolean } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [part, setPart] = useState<string | null>(null);

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
  const activeDay = day && days.some((d) => d.date === day && d.slots.length) ? day : firstOpen;
  const parts = partsOf(days.find((d) => d.date === activeDay));
  const open = parts.filter((p) => p.first);
  const choices = [...open.map((p) => ({ id: p.id, label: p.label, slot: p.first! })), ...(open.length > 1 ? [{ id: "either", label: "Either", slot: open[0]!.first! }] : [])];
  const chosen = choices.find((c) => c.id === part) ?? null;

  if (!serviceId) return <p className="text-sm text-ink-muted">Choose a package first.</p>;
  if (!current) return <p className="text-sm text-ink-muted" aria-live="polite">Loading the calendar…</p>;
  if (current.failed)
    return (
      <p className="text-sm text-error" role="alert">
        We couldn&rsquo;t load the calendar. Please refresh the page and try again.
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
      <legend className="text-sm font-medium mb-1.5">Which day works for you?</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Days">
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
              aria-label={`${weekday} ${label}${full ? " (booked)" : ""}`}
              onClick={() => {
                setDay(d.date);
                setPart(null);
              }}
              className={cn(
                "flex min-w-[4.75rem] shrink-0 flex-col items-center gap-0.5 border px-3 py-2.5 text-sm transition-colors",
                selected ? "border-asphalt bg-asphalt text-chalk" : "border-line bg-white hover:border-ink-muted",
                full && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">{weekday}</span>
              <span className="font-semibold">{label}</span>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <>
          <p className="text-sm font-medium" id={`${id}-part`}>
            What part of the day?
          </p>
          <div className={cn("grid gap-2", choices.length > 2 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup" aria-labelledby={`${id}-part`}>
            {choices.map((c) => (
              <label key={c.id} className={cn("choice justify-center py-3 text-sm font-semibold", part === c.id && "!border-asphalt")}>
                <input type="radio" name="dayPart" value={c.id} required={required} checked={part === c.id} onChange={() => setPart(c.id)} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
          {/* Placeholder start that holds the window until the owner sets the exact time. */}
          {chosen && <input type="hidden" name="slotStart" value={chosen.slot} />}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Preferred time <span className="font-normal text-ink-muted">(optional)</span>
            </span>
            <input name="preferredTime" maxLength={40} placeholder="e.g. around 9:30, or after 1 PM" className="field" autoComplete="off" />
          </label>
        </>
      )}
      <p className="text-sm text-ink-muted">
        We&rsquo;ll confirm the exact time with your quote, or call you to set one.
      </p>
      {error && (
        <p id={`${id}-err`} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
