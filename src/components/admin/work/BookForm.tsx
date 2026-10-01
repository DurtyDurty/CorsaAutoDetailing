"use client";

import { useActionState, useState } from "react";
import type { BookingOptions, CustomerOption } from "@shared/api";
import { bookAction, type BookState } from "@/app/admin/book/actions";
import { Button } from "@/components/ui/Button";

const DURATIONS = [60, 90, 120, 180, 240, 300, 360];
const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

/** Label tied to its control by id, so the control's name is exactly the label. */
function Labeled({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Labeled id={`book-${name}`} label={label}>
      <input id={`book-${name}`} name={name} className="field min-h-10 py-2" {...rest} />
    </Labeled>
  );
}

/** New appointment on the dashboard. The requestId is fixed for this form, so a retry or "book anyway" books once. */
export function BookForm({
  options,
  customers,
  presetLeadId,
  requestId,
  defaultDate,
}: {
  options: BookingOptions;
  customers: CustomerOption[];
  presetLeadId?: string;
  requestId: string;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction, { error: null, canOverride: false });
  const [mode, setMode] = useState<"existing" | "new">(presetLeadId || customers.length > 0 ? "existing" : "new");
  const [serviceId, setServiceId] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(options.defaultDurationMinutes);

  return (
    <form action={action} className="flex flex-col gap-5 max-w-3xl">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="mode" value={mode} />

      <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-ink-muted">Customer</h2>
          {!presetLeadId && (
            <div className="grid grid-cols-2 border border-line rounded-sm p-0.5 text-sm" role="radiogroup" aria-label="Customer">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-sm ${mode === m ? "bg-asphalt text-chalk" : "text-ink-muted"}`}
                >
                  {m === "existing" ? "Existing" : "New customer"}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "existing" ? (
          <Labeled id="book-leadId" label="Choose a customer">
            <select
              id="book-leadId"
              name="leadId"
              defaultValue={presetLeadId ?? ""}
              className="field min-h-10 py-2"
              onChange={(e) => {
                const c = customers.find((x) => x.leadId === e.target.value);
                const s = options.services.find((x) => x.id === c?.serviceId);
                if (s && !serviceId) {
                  setServiceId(s.id);
                  setPrice(String(s.priceCents / 100));
                  if (s.durationMinutes) setDuration(s.durationMinutes);
                }
              }}
            >
              <option value="">Choose…</option>
              {customers.map((c) => (
                <option key={c.leadId} value={c.leadId}>
                  {c.name} · {c.email}
                  {c.vehicle ? ` · ${c.vehicle}` : ""}
                </option>
              ))}
            </select>
          </Labeled>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name" name="firstName" required autoComplete="off" />
            <Input label="Last name" name="lastName" autoComplete="off" />
            <Input label="Email (confirmation goes here)" name="email" type="email" required />
            <Input label="Phone" name="phone" type="tel" />
            <Input label="Service address" name="serviceAddress" required />
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Input label="City" name="city" />
              <Input label="ZIP" name="zip" inputMode="numeric" maxLength={5} required />
            </div>
            <div className="grid grid-cols-[6rem_1fr_1fr] gap-3 sm:col-span-2">
              <Input label="Year" name="vehicleYear" inputMode="numeric" maxLength={4} />
              <Input label="Make" name="vehicleMake" />
              <Input label="Model" name="vehicleModel" />
            </div>
          </div>
        )}
      </section>

      <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
        <h2 className="text-xs uppercase tracking-[0.16em] text-ink-muted">Service &amp; time</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled id="book-serviceId" label="Service" className="sm:col-span-2">
            <select
              id="book-serviceId"
              name="serviceId"
              required
              value={serviceId}
              className="field min-h-10 py-2"
              onChange={(e) => {
                const s = options.services.find((x) => x.id === e.target.value);
                setServiceId(e.target.value);
                if (s) {
                  setPrice(String(s.priceCents / 100));
                  if (s.durationMinutes) setDuration(s.durationMinutes);
                }
              }}
            >
              <option value="">Choose a package</option>
              {options.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · from {money(s.priceCents)}
                  {s.billing === "monthly" ? "/mo" : ""}
                </option>
              ))}
            </select>
          </Labeled>
          <Input label="Date" name="date" type="date" required defaultValue={defaultDate} />
          <Input label="Time (Eastern)" name="time" type="time" step={900} required defaultValue="09:00" />
          <Labeled id="book-durationMinutes" label="How long">
            <select id="book-durationMinutes" name="durationMinutes" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="field min-h-10 py-2">
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)}.5 hr`}
                </option>
              ))}
            </select>
          </Labeled>
          <Input label="Price ($)" name="price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <p className="text-xs text-ink-muted">
          Keeps {options.travelBufferMinutes} minutes free after the job for travel. Working hours {options.workHours.start}–{options.workHours.end}.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notes (only you see these)</span>
          <textarea name="notes" maxLength={1000} className="field min-h-20" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendConfirmation" defaultChecked className="checkbox" /> Email a confirmation from your business address
        </label>
        {state.canOverride && (
          <label className="flex items-center gap-2 text-sm text-[#8a5a12]">
            <input type="checkbox" name="override" className="checkbox" /> Book anyway (outside working hours or a day off)
          </label>
        )}
      </section>

      {state.error && (
        <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="apex" size="lg" disabled={pending}>
          {pending ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}