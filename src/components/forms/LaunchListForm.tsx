"use client";

import { submitLaunchList } from "@/app/actions/leads";
import { business } from "@/config/business";
import { ServiceSelect } from "./ServiceSelect";
import {
  ConsentFields,
  Field,
  FormMessage,
  FormMeta,
  Select,
  SubmitButton,
  TextInput,
  useLeadForm,
} from "./primitives";

export function LaunchListForm({
  compact = false,
  initialService,
}: {
  compact?: boolean;
  /** Pre-selects the package a visitor chose before landing here. */
  initialService?: string;
}) {
  const { onSubmit, pending, errors, message, onStart } = useLeadForm(submitLaunchList, {
    formName: "launch_list",
    leadType: "launch_list",
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" onFocus={onStart} noValidate aria-label="Launch list signup">
      <FormMeta />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="firstName" label="First name" error={errors.firstName}>
          {(p) => <TextInput name="firstName" autoComplete="given-name" required {...p} />}
        </Field>
        <Field name="zip" label="ZIP code" error={errors.zip} hint="So we know whether we can reach you.">
          {(p) => <TextInput name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} required {...p} />}
        </Field>
      </div>
      <Field name="email" label="Email" error={errors.email}>
        {(p) => <TextInput name="email" type="email" autoComplete="email" required {...p} />}
      </Field>
      {!compact && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="serviceId" label="Service you're interested in" optional error={errors.serviceId} className="sm:col-span-2">
            {(p) => <ServiceSelect name="serviceId" placeholder="Choose…" showPrices={false} defaultValue={initialService ?? ""} {...p} />}
          </Field>
          <Field name="phone" label="Phone" optional error={errors.phone}>
            {(p) => <TextInput name="phone" type="tel" autoComplete="tel" {...p} />}
          </Field>
          <Field name="preferredContact" label="Preferred contact" optional error={errors.preferredContact}>
            {(p) => (
              <Select name="preferredContact" defaultValue="" {...p}>
                <option value="">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
                <option value="text">Text message</option>
              </Select>
            )}
          </Field>
        </div>
      )}
      <ConsentFields
        serviceText={business.consent.serviceText}
        marketingText={business.consent.marketingText}
        error={errors.serviceConsent}
      />
      <FormMessage message={message} />
      <div>
        <SubmitButton pending={pending} className="w-full sm:w-auto">
          Join the launch list
        </SubmitButton>
      </div>
    </form>
  );
}
