"use client";

import { useEffect, useRef, useState } from "react";
import { submitBookingRequest } from "@/app/actions/leads";
import { business, getService } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { BOOKING_CONDITION_FLAGS, formatUsd, optionalAddOns } from "@/lib/pricing";
import { cn, formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { DayPartPicker } from "./DayPartPicker";
import { Field, FormMessage, FormMeta, Select, SubmitButton, TextInput, useLeadForm } from "./primitives";

/** Which step each server-validated field lives on, so an error jumps back to it. */
const FIELD_STEP: Record<string, number> = {
  serviceId: 0,
  conditionFlags: 0,
  addOns: 0,
  vehicleYear: 1,
  vehicleMake: 1,
  vehicleModel: 1,
  town: 1,
  zip: 1,
  name: 1,
  phone: 1,
  email: 1,
  photos: 1,
  slotStart: 2,
  dayPart: 2,
  preferredTime: 2,
};

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Vercel refuses request bodies over 4.5MB; leave room for the form's text fields. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const PHOTO_MAX_SIDE = 1600;

/** A JPEG no larger than PHOTO_MAX_SIDE on its long side (a few hundred KB), for the upload. */
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("Couldn't shrink the photo");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * The booking request in three steps (2026-10-28 redesign): package, then the car and contact details, then a
 * day and part of the day. Saves like every other form (Supabase, then the emails) and only reports the
 * Google Ads "Booking request sent" conversion once the server has saved it.
 */
export function BookingWizard({
  lang,
  initialService,
  firstTimeOffer = false,
  photosEnabled,
}: {
  lang: Lang;
  initialService?: string;
  firstTimeOffer?: boolean;
  photosEnabled: boolean;
}) {
  const t = dict(lang);
  const f = t.form;
  const { onSubmit, pending, errors, message, state, onStart } = useLeadForm(submitBookingRequest, {
    formName: "booking_form",
    leadType: "quote_request",
    bookingConversion: true,
  });
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(initialService && (getService(initialService) || initialService === "help") ? initialService : "");
  const [town, setTown] = useState("");
  const [firstTime, setFirstTime] = useState(firstTimeOffer);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);

  // Jump to the first step with a server-side error (state adjusted during render).
  const [seenErrors, setSeenErrors] = useState(errors);
  if (errors !== seenErrors) {
    setSeenErrors(errors);
    const keys = Object.keys(errors);
    if (keys.length > 0) setStep(Math.min(...keys.map((k) => FIELD_STEP[k] ?? 0)));
  }

  useEffect(() => {
    // Move focus to the step heading after Continue/Back, not on first render.
    if (!started.current) {
      started.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const fieldError = (k: string) => (errors[k] ? (lang === "es" ? (f.errors[k] ?? errors[k]) : errors[k]) : undefined);
  const phone = business.contact.phone;
  const shownMessage = !message ? null : state?.status === "invalid" ? (lang === "es" ? f.fixFields : message) : lang === "es" ? f.failed(phone) : message;

  const packages = business.services.filter((s) => !s.plan);
  const club = business.services.find((s) => s.plan);
  const addOns = optionalAddOns();
  const holdService = serviceId === "help" ? business.booking.helpHoldService : serviceId;

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    const panel = form.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const controls = panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
    let firstInvalid: HTMLElement | null = null;
    controls?.forEach((c) => {
      if (!c.checkValidity() && !firstInvalid) firstInvalid = c;
    });
    if (firstInvalid) {
      (firstInvalid as HTMLElement).focus();
      form.reportValidity();
      return;
    }
    setStep((s) => Math.min(s + 1, 2));
  }

  async function onPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    const tooBig = files.find((file) => file.size > MAX_PHOTO_BYTES);
    if (files.length > MAX_PHOTOS || tooBig) {
      setPhotoError(files.length > MAX_PHOTOS ? f.tooManyPhotos : f.photoTooBig(tooBig!.name));
      input.value = "";
      return;
    }
    setPhotoError(null);
    // Phone photos are several MB each and a request can carry only ~4MB, so they're shrunk here before sending.
    try {
      const small = await Promise.all(files.map(shrinkPhoto));
      if (small.reduce((s, file) => s + file.size, 0) > MAX_UPLOAD_BYTES) {
        setPhotoError(f.photosTooLarge);
        input.value = "";
        return;
      }
      const dt = new DataTransfer();
      small.forEach((file) => dt.items.add(file));
      input.files = dt.files;
    } catch {
      // Couldn't shrink them in this browser: send nothing rather than a request that would be refused.
      setPhotoError(f.photosTooLarge);
      input.value = "";
    }
  }

  const option = (id: string, title: string, price: string | null, note: string | null, badge?: string | null) => (
    <label
      key={id}
      className={cn(
        "relative flex cursor-pointer items-center justify-between gap-4 rounded-md border bg-white p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-apex-deep",
        serviceId === id ? "border-2 border-apex-deep p-[15px]" : "border-line hover:border-ink-muted",
      )}
    >
      <input type="radio" name="serviceId" value={id} required checked={serviceId === id} onChange={() => setServiceId(id)} className="sr-only" />
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{title}</span>
        {note && <span className="mt-0.5 block text-sm text-ink-muted">{note}</span>}
      </span>
      {price && <span className={cn("shrink-0 font-display text-2xl leading-none", serviceId === id && "text-apex-deep")}>{price}</span>}
      {badge && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-apex-deep px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white">{badge}</span>
      )}
    </label>
  );

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onFocus={onStart}
      encType="multipart/form-data"
      aria-label={f.aria}
      lang={t.htmlLang}
      className="flex min-w-0 flex-col gap-6 rounded-lg bg-chalk p-5 text-ink shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-8"
    >
      <FormMeta />
      <input type="hidden" name="lang" value={lang} />

      <div>
        <ol className="grid grid-cols-3 gap-1.5" aria-label={f.stepOf(step + 1, 3)}>
          {f.stepLabels.map((label, i) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-apex-deep" : "bg-line")} aria-hidden="true" />
              <span className={cn("truncate text-xs sm:text-sm", i === step ? "font-semibold text-ink" : "text-ink-muted")}>
                {i + 1}. {label}
                {i === step && <span className="sr-only"> ({f.stepOf(i + 1, 3)})</span>}
              </span>
            </li>
          ))}
        </ol>
        <p ref={headingRef} tabIndex={-1} className="mt-5 font-display text-3xl outline-none">
          {f.stepLabels[step]}
        </p>
      </div>

      {/* Step 1: package and anything we should know */}
      <div data-step="0" hidden={step !== 0} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2.5" aria-describedby={fieldError("serviceId") ? "svc-err" : undefined}>
          <legend className="mb-1.5 text-sm font-medium">{f.packageLegend}</legend>
          {packages.map((s) => option(s.id, s.name, `${formatUsd(s.price)}+`, null, s.badge ? t.packages.popular : null))}
          {club && option(club.id, club.name, `${formatUsd(club.price)}`, `${t.packages.perVisit}. ${f.clubNote}`)}
          {option("help", f.help.title, null, f.help.body(phone ? formatPhone(phone.replace(/\D/g, "").slice(-10)) : null))}
          {fieldError("serviceId") && (
            <p id="svc-err" className="text-sm text-error" role="alert">
              {fieldError("serviceId")}
            </p>
          )}
        </fieldset>
        {/* One list (owner, 2026-10-28): what the car has, then the add-ons. Two field names, one group. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            {f.flagsLegend} <span className="font-normal text-ink-muted">({f.optional})</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOOKING_CONDITION_FLAGS.map((flag) => (
              <label key={flag} className="choice py-3">
                <input type="checkbox" name="conditionFlags" value={flag} className="checkbox" />
                <span className="font-medium leading-snug">{f.flags[flag]}</span>
              </label>
            ))}
            {addOns.map((a) => (
              <label key={a.id} className="choice py-3">
                <input type="checkbox" name="addOns" value={a.id} className="checkbox" />
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{lang === "es" ? a.es.name : a.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.08em] text-apex-deep">{f.addOnPriced}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Step 2: the car and you */}
      <div data-step="1" hidden={step !== 1} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{f.vehicle}</legend>
          <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-2">
            <Field name="vehicleYear" label={f.year} error={fieldError("vehicleYear")}>
              {(p) => <TextInput name="vehicleYear" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="2019" required={step === 1} {...p} />}
            </Field>
            <Field name="vehicleMake" label={f.make} error={fieldError("vehicleMake")}>
              {(p) => <TextInput name="vehicleMake" placeholder="Toyota" maxLength={60} required={step === 1} {...p} />}
            </Field>
            <Field name="vehicleModel" label={f.model} error={fieldError("vehicleModel")}>
              {(p) => <TextInput name="vehicleModel" placeholder="RAV4" maxLength={60} required={step === 1} {...p} />}
            </Field>
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="town" label={f.town} error={fieldError("town")}>
            {(p) => (
              <Select name="town" required={step === 1} value={town} onChange={(e) => setTown(e.target.value)} {...p}>
                <option value="">{f.chooseTown}</option>
                {business.serviceAreas.communities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
                <option value="other">{f.otherTown}</option>
              </Select>
            )}
          </Field>
          {town === "other" && (
            <Field name="zip" label={f.zip} hint={f.zipHint} error={fieldError("zip")}>
              {(p) => <TextInput name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="\d{5}" required={step === 1} {...p} />}
            </Field>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="name" label={f.name} error={fieldError("name")}>
            {(p) => <TextInput name="name" autoComplete="name" maxLength={100} required={step === 1} {...p} />}
          </Field>
          <Field name="phone" label={f.phone} hint={f.phoneHint} error={fieldError("phone")}>
            {(p) => <TextInput name="phone" type="tel" inputMode="tel" autoComplete="tel" required={step === 1} {...p} />}
          </Field>
        </div>
        <Field name="email" label={f.email} optional hint={f.emailHint} error={fieldError("email")}>
          {(p) => <TextInput name="email" type="email" autoComplete="email" {...p} />}
        </Field>
        {business.militaryDiscount.enabled && (
          <label className="choice">
            <input type="checkbox" name="military" className="checkbox" />
            <span>
              <span className="block font-medium leading-snug">
                {lang === "es" ? business.militaryDiscount.es.checkboxLabel : business.militaryDiscount.checkboxLabel}
              </span>
              <span className="mt-0.5 block text-sm text-ink-muted">{lang === "es" ? business.militaryDiscount.es.note : business.militaryDiscount.note}</span>
            </span>
          </label>
        )}
        {business.firstTimeOffer.enabled && (
          <label className="choice">
            <input type="checkbox" name="firstTimeOffer" className="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
            <span>
              <span className="block font-medium leading-snug">{lang === "es" ? business.firstTimeOffer.es.checkboxLabel : business.firstTimeOffer.checkboxLabel}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{lang === "es" ? business.firstTimeOffer.es.terms : business.firstTimeOffer.terms}</span>
            </span>
          </label>
        )}
        {photosEnabled && (
          <Field name="photos" label={f.photos} optional hint={f.photosHint} error={fieldError("photos") ?? photoError ?? undefined}>
            {(p) => (
              <input
                id={p.id}
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="field py-2.5"
                onChange={onPhotosChange}
                aria-describedby={p.describedBy}
              />
            )}
          </Field>
        )}
      </div>

      {/* Step 3: day and part of the day */}
      <div data-step="2" hidden={step !== 2} className="flex flex-col gap-5">
        <DayPartPicker serviceId={holdService} required={step === 2} lang={lang} error={fieldError("slotStart") ?? fieldError("dayPart")} />
        <p className="text-xs leading-relaxed text-ink-muted">
          {lang === "es"
            ? f.ack(business.consent.es.serviceText, business.consent.es.priceAcknowledgmentText)
            : f.ack(business.consent.serviceText, business.consent.priceAcknowledgmentText)}
        </p>
      </div>

      <FormMessage message={shownMessage} />

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending} className={cn("rounded-full", step === 0 && "max-sm:hidden sm:invisible")}>
          {f.back}
        </Button>
        {step === 2 ? (
          <SubmitButton pending={pending} busyLabel={f.sending} className="w-full rounded-full sm:w-auto">
            {f.submit}
          </SubmitButton>
        ) : (
          <Button type="button" size="lg" onClick={goNext} className="w-full rounded-full sm:w-auto">
            {f.continue}
          </Button>
        )}
      </div>
      <p className="-mt-2 text-center text-sm text-ink-muted">
        {f.nothingCharged}
        {phone && (
          <>
            {" "}
            {f.rather}{" "}
            <a href={`tel:+1${phone.replace(/\D/g, "").slice(-10)}`} className="font-semibold text-ink underline underline-offset-4">
              {phone}
            </a>
            .
          </>
        )}
      </p>
    </form>
  );
}
