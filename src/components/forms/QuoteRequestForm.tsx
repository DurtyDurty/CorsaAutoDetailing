"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { submitBooking, submitQuoteRequest } from "@/app/actions/leads";
import { business, type BusinessMode, type ServiceId } from "@/config/business";
import { track } from "@/lib/analytics";
import { CONDITION_FLAGS, billingSuffix, computeEstimate, conditionFlagLabel, formatUsd } from "@/lib/pricing";
import { lookupZip, isValidZip } from "@/lib/zip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { InspectionDisclaimer } from "@/components/site/Disclosures";
import { SlotPicker } from "./SlotPicker";
import { ServiceSelect } from "./ServiceSelect";
import {
  ChoiceGroup,
  ConsentFields,
  Field,
  FormMessage,
  FormMeta,
  Select,
  SubmitButton,
  Textarea,
  TextInput,
  useLeadForm,
} from "./primitives";

const REQUEST_STEPS = ["Service & vehicle", "Condition", "Location & timing", "Contact & review"] as const;
const BOOKING_STEPS = ["Service & vehicle", "Condition", "Location & time", "Contact & deposit"] as const;

/** Which step each server-validated field lives on, so errors jump to the right place. */
const FIELD_STEP: Record<string, number> = {
  serviceId: 0,
  vehicleYear: 0,
  vehicleMake: 0,
  vehicleModel: 0,
  condition: 1,
  conditionFlags: 1,
  concerns: 1,
  photos: 1,
  serviceAddress: 2,
  zip: 2,
  city: 2,
  locationType: 2,
  timeWindows: 2,
  preferredDate: 2,
  notes: 2,
  slotStart: 2,
  firstName: 3,
  lastName: 3,
  email: 3,
  phone: 3,
  preferredContact: 3,
  serviceConsent: 3,
  priceAcknowledgment: 3,
  bookingPolicy: 3,
};

interface Props {
  mode: BusinessMode;
  /** Earliest date preference the server will accept, or null when dates are not accepted yet. */
  earliestDate: string | null;
  photosEnabled: boolean;
  initialService?: string;
  /** Online booking: pick an open time and pay the deposit (LIVE + payments configured). */
  booking?: boolean;
}

export function QuoteRequestForm({ mode, earliestDate, photosEnabled, initialService, booking = false }: Props) {
  const { onSubmit, pending, errors, message, onStart } = useLeadForm(booking ? submitBooking : submitQuoteRequest, {
    formName: booking ? "booking" : "quote_request",
    leadType: "quote_request",
  });
  const STEPS = booking ? BOOKING_STEPS : REQUEST_STEPS;
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(initialService ?? "");

  const [condition, setCondition] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [contactMethod, setContactMethod] = useState("email");
  const [zip, setZip] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Jump to the first step that has a server-side error (state adjusted during render).
  const [seenErrors, setSeenErrors] = useState(errors);
  if (errors !== seenErrors) {
    setSeenErrors(errors);
    const keys = Object.keys(errors);
    if (keys.length > 0) setStep(Math.min(...keys.map((k) => FIELD_STEP[k] ?? 3)));
  }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [step]);

  const estimate = useMemo(
    () =>
      serviceId ? computeEstimate({ serviceId, condition: condition as never, conditionFlags: flags }) : null,
    [serviceId, condition, flags],
  );
  const zipInfo = isValidZip(zip) ? lookupZip(zip) : null;

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    // Validate only controls in the current step with native constraints.
    const panel = form.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const controls = panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    );
    let firstInvalid: HTMLElement | null = null;
    controls?.forEach((c) => {
      if (!c.checkValidity() && !firstInvalid) firstInvalid = c;
    });
    if (firstInvalid) {
      (firstInvalid as HTMLElement).focus();
      form.reportValidity();
      return;
    }
    if (step === 0 && serviceId) {
      track("pricing_vehicle_selected", { service: serviceId });
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function onPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 5) {
      setPhotoError("Please choose up to 5 photos.");
      e.target.value = "";
      return;
    }
    const tooBig = files.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      setPhotoError(`${tooBig.name} is larger than 10MB.`);
      e.target.value = "";
      return;
    }
    setPhotoError(null);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-6"
      onFocus={onStart}
      aria-label="Service request"
      encType="multipart/form-data"
    >
      <FormMeta />

      {/* Progress */}
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-col gap-1.5">
            <span
              className={cn("h-1 rounded-full", i <= step ? "bg-asphalt" : "bg-line")}
              aria-hidden="true"
            />
            <span className={cn("text-xs sm:text-sm truncate", i === step ? "text-ink font-medium" : "text-ink-muted")}>
              <span className="sr-only">Step {i + 1}: </span>
              {label}
              {i === step && <span className="sr-only"> (current)</span>}
            </span>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl sm:text-3xl outline-none">
        {STEPS[step]}
      </h2>

      {mode === "PRELAUNCH" && (
        <FormMessage
          tone="info"
          message="We're preparing to launch and aren't confirming appointments yet. Submitting this request saves your details so we can send a quote and timing when we open."
        />
      )}

      {/* Step 1 */}
      <div data-step="0" hidden={step !== 0} className="flex flex-col gap-5">
        <Field name="serviceId" label="Service" error={errors.serviceId}>
          {(p) => (
            <ServiceSelect
              name="serviceId"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
              {...p}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="vehicleYear" label="Year" error={errors.vehicleYear}>
            {(p) => (
              <TextInput
                name="vehicleYear"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="2019"
                required={step === 0}
                {...p}
              />
            )}
          </Field>
          <Field name="vehicleMake" label="Make" error={errors.vehicleMake}>
            {(p) => <TextInput name="vehicleMake" placeholder="Toyota" required={step === 0} {...p} />}
          </Field>
          <Field name="vehicleModel" label="Model" error={errors.vehicleModel}>
            {(p) => <TextInput name="vehicleModel" placeholder="4Runner" required={step === 0} {...p} />}
          </Field>
        </div>
        <EstimatePanel estimate={estimate} mode={mode} compact />
      </div>

      {/* Step 2 */}
      <div data-step="1" hidden={step !== 1} className="flex flex-col gap-5">
        <ChoiceGroup
          legend="How would you describe the vehicle's condition?"
          name="condition"
          type="radio"
          required
          defaultValue={condition}
          onChange={setCondition}
          error={errors.condition}
          options={[
            { value: "normal", label: "Normal maintenance", description: "Driven regularly, cleaned occasionally." },
            { value: "deeper", label: "Needs deeper cleaning", description: "It's been a while, or there's a specific problem." },
            { value: "unsure", label: "Not sure", description: "We'll figure it out together." },
          ]}
        />
        <ChoiceGroup
          legend="Anything we should know about?"
          name="conditionFlags"
          type="checkbox"
          columns={3}
          hint="Checking a box never changes the estimate. It tells us what to look at before quoting."
          defaultValue={flags}
          onChange={(v) => setFlags((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]))}
          error={errors.conditionFlags}
          options={CONDITION_FLAGS.map((f) => ({ value: f, label: conditionFlagLabel(f) }))}
        />
        <Field name="concerns" label="Describe any concerns" optional error={errors.concerns}>
          {(p) => <Textarea name="concerns" maxLength={1000} {...p} />}
        </Field>
        {photosEnabled && (
          <Field
            name="photos"
            label="Vehicle photos"
            optional
            hint="Up to 5 JPEG, PNG or WebP images, 10MB each. Photos are stored privately and only used to prepare your quote."
            error={errors.photos ?? photoError ?? undefined}
          >
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

      {/* Step 3 */}
      <div data-step="2" hidden={step !== 2} className="flex flex-col gap-5">
        <Field
          name="serviceAddress"
          label="Service address"
          hint="Street address where the vehicle will be. Used only to plan and confirm your visit."
          error={errors.serviceAddress}
        >
          {(p) => (
            <TextInput
              name="serviceAddress"
              autoComplete="street-address"
              maxLength={200}
              required={step === 2}
              {...p}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="zip" label="ZIP code" error={errors.zip} hint={zipInfo?.message}>
            {(p) => (
              <TextInput
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                required={step === 2}
                onChange={(e) => setZip(e.target.value)}
                {...p}
              />
            )}
          </Field>
          <Field name="city" label="City or neighborhood" optional error={errors.city}>
            {(p) => <TextInput name="city" autoComplete="address-level2" {...p} />}
          </Field>
        </div>
        <ChoiceGroup
          legend="Where would the vehicle be?"
          name="locationType"
          type="radio"
          columns={3}
          required
          error={errors.locationType}
          options={[
            { value: "home", label: "Home" },
            { value: "work", label: "Workplace" },
            { value: "other", label: "Somewhere else" },
          ]}
        />
        {booking ? (
          <SlotPicker serviceId={serviceId} required={step === 2} error={errors.slotStart} />
        ) : (
          <ChoiceGroup
            legend="Preferred time windows"
            name="timeWindows"
            type="checkbox"
            columns={2}
            hint="Preferences only, not a reservation. We'll confirm a time with you."
            error={errors.timeWindows}
            options={business.scheduling.timeWindows.map((w) => ({ value: w.id, label: w.label }))}
          />
        )}
        {booking ? null : earliestDate ? (
          <Field
            name="preferredDate"
            label="Preferred date"
            optional
            hint={`Earliest we can consider is ${earliestDate} (Eastern time). This is a preference, not a booking.`}
            error={errors.preferredDate}
          >
            {(p) => <TextInput name="preferredDate" type="date" min={earliestDate} {...p} />}
          </Field>
        ) : (
          <p className="text-sm text-ink-muted border border-line bg-white px-4 py-3 rounded-sm">
            We&rsquo;ll ask about specific dates once an opening date is set.
          </p>
        )}
        <Field
          name="notes"
          label="Notes about the space"
          optional
          hint="Is there room to work around the vehicle? Is water or an outdoor outlet nearby? This just helps us plan. It isn't a requirement."
          error={errors.notes}
        >
          {(p) => <Textarea name="notes" maxLength={1500} {...p} />}
        </Field>
      </div>

      {/* Step 4 */}
      <div data-step="3" hidden={step !== 3} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="firstName" label="First name" error={errors.firstName}>
            {(p) => <TextInput name="firstName" autoComplete="given-name" required={step === 3} {...p} />}
          </Field>
          <Field name="lastName" label="Last name" optional error={errors.lastName}>
            {(p) => <TextInput name="lastName" autoComplete="family-name" {...p} />}
          </Field>
          <Field name="email" label="Email" error={errors.email}>
            {(p) => <TextInput name="email" type="email" autoComplete="email" required={step === 3} {...p} />}
          </Field>
          <Field name="phone" label="Phone" error={errors.phone}>
            {(p) => <TextInput name="phone" type="tel" autoComplete="tel" required={step === 3} {...p} />}
          </Field>
        </div>
        <Field name="preferredContact" label="How should we reach you?" error={errors.preferredContact}>
          {(p) => (
            <Select
              name="preferredContact"
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value)}
              {...p}
            >
              <option value="email">Email</option>
              <option value="phone">Phone call</option>
              <option value="text">Text message</option>
            </Select>
          )}
        </Field>

        <EstimatePanel estimate={estimate} mode={mode} />

        <ConsentFields
          serviceText={business.consent.serviceText}
          marketingText={business.consent.marketingText}
          error={errors.serviceConsent}
        />

        {booking && serviceId && (
          <DepositPolicy serviceId={serviceId as ServiceId} required={step === 3} error={errors.bookingPolicy} />
        )}

        <PriceAcknowledgment required={step === 3} error={errors.priceAcknowledgment} />
      </div>

      <FormMessage message={message} />

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          Back
        </Button>
        {isLast ? (
          <SubmitButton pending={pending} className="w-full sm:w-auto">
            {booking && serviceId
              ? `Pay ${formatUsd((business.booking.depositCents[serviceId as ServiceId] ?? 0) / 100)} deposit & book`
              : mode === "PRELAUNCH"
                ? "Send my request"
                : "Request an appointment"}
          </SubmitButton>
        ) : (
          <Button type="button" size="lg" onClick={goNext} className="w-full sm:w-auto">
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}

/** Deposit amount, policy and the required agreement (online booking only). */
function DepositPolicy({ serviceId, required, error }: { serviceId: ServiceId; required: boolean; error?: string }) {
  const id = useId();
  const deposit = (business.booking.depositCents[serviceId] ?? 0) / 100;
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div id={`${id}-text`} className="border-l-[3px] border-asphalt bg-white px-4 py-3.5 text-sm leading-relaxed">
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink">Deposit due today</span>
          <span className="font-display text-2xl">{formatUsd(deposit)}</span>
        </p>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted">
          {business.booking.policy.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-2 text-ink-muted">You&rsquo;ll pay securely on Stripe&rsquo;s checkout page. We never see or store your card details.</p>
      </div>
      <label className="flex gap-3 items-start text-sm leading-relaxed font-medium">
        <input
          type="checkbox"
          name="bookingPolicy"
          className="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-text`, error ? `${id}-err` : null].filter(Boolean).join(" ")}
        />
        <span>
          {business.booking.policyAgreementText} <span className="text-error" aria-hidden="true">*</span>
        </span>
      </label>
      {error && (
        <p id={`${id}-err`} className="text-sm text-error -mt-1 ml-8" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Inspection disclaimer + required acknowledgment, placed directly above the submit button. */
function PriceAcknowledgment({ required, error }: { required: boolean; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <InspectionDisclaimer id={`${id}-text`} />
      <label className="flex gap-3 items-start text-sm leading-relaxed font-medium">
        <input
          type="checkbox"
          name="priceAcknowledgment"
          className="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-text`, error ? `${id}-err` : null].filter(Boolean).join(" ")}
        />
        <span>
          {business.consent.priceAcknowledgmentText} <span className="text-error" aria-hidden="true">*</span>
        </span>
      </label>
      {error && (
        <p id={`${id}-err`} className="text-sm text-error -mt-1 ml-8" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function EstimatePanel({
  estimate,
  mode,
  compact = false,
}: {
  estimate: ReturnType<typeof computeEstimate>;
  mode: BusinessMode;
  compact?: boolean;
}) {
  if (!estimate) {
    return compact ? null : (
      <div className="border border-line bg-white rounded-sm px-5 py-4 text-sm text-ink-muted">
        Choose a service to see an estimate.
      </div>
    );
  }
  return (
    <div className="border border-line bg-white rounded-sm px-5 py-4" aria-live="polite">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep font-semibold">
        {mode === "PRELAUNCH" ? "Planned estimate" : "Estimate"}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <p className="font-medium">
          {estimate.serviceName}
        </p>
        <p className="font-display text-2xl">
          {estimate.total !== null ? `${formatUsd(estimate.total)}${billingSuffix(estimate.billing)}` : "Custom quote"}
        </p>
      </div>
      {estimate.addOns.length > 0 && (
        <ul className="mt-2 text-sm text-ink-muted">
          {estimate.addOns.map((a) => (
            <li key={a.label} className="flex justify-between">
              <span>{a.label}</span>
              <span>{formatUsd(a.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && estimate.reviewNotes.length > 0 && (
        <ul className="mt-3 text-sm text-ink-muted list-disc pl-5 space-y-1">
          {estimate.reviewNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Starting price for a vehicle in average condition. {estimate.finalQuoteNotice} {estimate.taxNotice} No
        payment is collected until availability and final pricing are confirmed.
      </p>
    </div>
  );
}
