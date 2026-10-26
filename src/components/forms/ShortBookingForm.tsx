"use client";

import { useState } from "react";
import { submitShortRequest } from "@/app/actions/leads";
import { business, getService, type ServiceDefinition } from "@/config/business";
import { formatServicePrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { DayPartPicker } from "./DayPartPicker";
import { Field, FormMessage, FormMeta, Select, SubmitButton, TextInput, useLeadForm } from "./primitives";

/**
 * The short booking request (/book, /request): one screen, only what's needed
 * to call the customer back and hold a time. The package cards double as the
 * "packages and prices" panel above the rest of the form.
 * Condition, street address and photos are asked by the owner afterwards.
 */
export function ShortBookingForm({ initialService, firstTimeOffer = false }: { initialService?: string; firstTimeOffer?: boolean }) {
  const { onSubmit, pending, errors, message, onStart } = useLeadForm(submitShortRequest, {
    formName: "short_request",
    leadType: "quote_request",
    bookingConversion: true,
  });
  const [serviceId, setServiceId] = useState(initialService && getService(initialService) ? initialService : "");
  const [town, setTown] = useState("");
  const [firstTime, setFirstTime] = useState(firstTimeOffer);
  const visits = business.services.filter((s) => s.billing === "visit");
  const monthly = business.services.filter((s) => s.billing === "monthly");
  const towns = business.serviceAreas.communities;
  const phone = business.contact.phone;

  return (
    <form onSubmit={onSubmit} onFocus={onStart} className="flex flex-col gap-6" aria-label="Booking request">
      <FormMeta />

      <fieldset className="flex flex-col gap-3" data-field="serviceId" aria-describedby={errors.serviceId ? "pkg-err" : undefined}>
        <legend className="font-display text-2xl sm:text-3xl mb-1">1. Choose a package</legend>
        <p className="text-sm text-ink-muted -mt-1">Interior and exterior, at your home or work. Starting prices for a sedan; SUVs and trucks cost a little more.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {visits.map((s) => (
            <PackageChoice key={s.id} service={s} checked={serviceId === s.id} onChange={setServiceId} />
          ))}
        </div>
        {monthly.map((s) => (
          <PackageChoice key={s.id} service={s} checked={serviceId === s.id} onChange={setServiceId} compact />
        ))}
        {errors.serviceId && (
          <p id="pkg-err" className="text-sm text-error" role="alert">
            {errors.serviceId}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl sm:text-3xl">2. Your details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="name" label="Name" error={errors.name}>
            {(p) => <TextInput name="name" autoComplete="name" required maxLength={100} {...p} />}
          </Field>
          <Field name="phone" label="Phone" hint="We'll text or call to confirm." error={errors.phone}>
            {(p) => <TextInput name="phone" type="tel" inputMode="tel" autoComplete="tel" required {...p} />}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium mb-1.5">Vehicle</legend>
          <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-2">
            <Field name="vehicleYear" label="Year" error={errors.vehicleYear}>
              {(p) => <TextInput name="vehicleYear" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="2019" required {...p} />}
            </Field>
            <Field name="vehicleMake" label="Make" error={errors.vehicleMake}>
              {(p) => <TextInput name="vehicleMake" placeholder="Toyota" required maxLength={60} {...p} />}
            </Field>
            <Field name="vehicleModel" label="Model" error={errors.vehicleModel}>
              {(p) => <TextInput name="vehicleModel" placeholder="RAV4" required maxLength={60} {...p} />}
            </Field>
          </div>
        </fieldset>
        <Field name="town" label="Town" error={errors.town}>
          {(p) => (
            <Select name="town" required value={town} onChange={(e) => setTown(e.target.value)} {...p}>
              <option value="">Choose your town</option>
              {towns.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
              <option value="other">Somewhere else</option>
            </Select>
          )}
        </Field>
        {town === "other" && (
          <Field name="townOther" label="Which town?" optional error={errors.townOther}>
            {(p) => <TextInput name="townOther" autoComplete="address-level2" maxLength={80} {...p} />}
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-2xl sm:text-3xl">3. Preferred day</h2>
        <DayPartPicker serviceId={serviceId} required error={errors.slotStart ?? errors.dayPart ?? errors.preferredTime} />
      </div>

      <div className="flex flex-col gap-5 border-t border-line pt-5">
        <Field name="email" label="Email" optional hint="For your confirmation and quote by email. Leave it blank and we'll text you." error={errors.email}>
          {(p) => <TextInput name="email" type="email" autoComplete="email" {...p} />}
        </Field>
        {business.firstTimeOffer.enabled && (
          <label className="choice">
            <input type="checkbox" name="firstTimeOffer" className="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
            <span className="block font-medium leading-snug">{business.firstTimeOffer.checkboxLabel}</span>
          </label>
        )}
      </div>

      <FormMessage message={message} />

      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-muted leading-relaxed">
          By sending this request: {business.consent.serviceText} {business.consent.priceAcknowledgmentText}
        </p>
        <SubmitButton pending={pending} className="w-full">
          Send my request
        </SubmitButton>
        <p className="text-sm text-ink-muted text-center">
          Nothing is charged online.
          {phone && (
            <>
              {" "}
              Rather talk? Call or text{" "}
              <a href={`tel:+1${phone.replace(/\D/g, "").slice(-10)}`} className="font-semibold text-ink underline underline-offset-4">
                {phone}
              </a>
              .
            </>
          )}
        </p>
      </div>
    </form>
  );
}

function PackageChoice({
  service: s,
  checked,
  onChange,
  compact = false,
}: {
  service: ServiceDefinition;
  checked: boolean;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const points = (s.summary ?? s.includes).slice(0, compact ? 0 : 3);
  return (
    <label
      className={cn(
        // Phones: one row per package (name, price) so the contact fields come up quickly; wider screens: cards.
        "relative flex cursor-pointer flex-row items-center justify-between gap-4 rounded-md border bg-white p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-apex-deep",
        checked ? "border-2 border-apex-deep p-[15px]" : "border-line hover:border-ink-muted",
        !compact && "sm:flex-col sm:items-stretch sm:justify-start sm:gap-1",
      )}
    >
      <input type="radio" name="serviceId" value={s.id} required checked={checked} onChange={() => onChange(s.id)} className="sr-only" />
      {s.badge && !compact && (
        <span className="absolute -top-2.5 right-3 rounded-sm bg-apex-deep px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white">
          {s.badge}
        </span>
      )}
      <span className="font-semibold leading-snug">{s.name}</span>
      <span className={cn("shrink-0 font-display text-2xl leading-none sm:text-3xl", checked && "text-apex-deep", compact && "sm:text-2xl")}>
        {formatServicePrice(s)}
        <span className="align-top text-sm text-ink-muted">+</span>
      </span>
      {points.length > 0 && (
        <ul className="mt-1 hidden space-y-0.5 text-sm text-ink-muted sm:block">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </label>
  );
}
