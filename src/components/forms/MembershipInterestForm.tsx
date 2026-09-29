"use client";

import { submitMembershipInterest } from "@/app/actions/leads";
import { business } from "@/config/business";
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

export function MembershipInterestForm() {
  const { onSubmit, pending, errors, message, onStart } = useLeadForm(submitMembershipInterest, {
    formName: "membership_interest",
    leadType: "membership_interest",
    submittedEvent: "membership_interest_submitted",
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" onFocus={onStart} noValidate aria-label="Maintenance plan interest">
      <FormMeta />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="firstName" label="First name" error={errors.firstName}>
          {(p) => <TextInput name="firstName" autoComplete="given-name" required {...p} />}
        </Field>
        <Field name="zip" label="ZIP code" error={errors.zip}>
          {(p) => <TextInput name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} required {...p} />}
        </Field>
      </div>
      <Field name="email" label="Email" error={errors.email}>
        {(p) => <TextInput name="email" type="email" autoComplete="email" required {...p} />}
      </Field>
      <Field name="vehicleCategory" label="Vehicle type" optional error={errors.vehicleCategory}>
        {(p) => (
          <Select name="vehicleCategory" defaultValue="" {...p}>
            <option value="">Choose…</option>
            {business.vehicleCategories.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <ChoiceGroup
        legend="Which visit cadence sounds right?"
        name="cadence"
        type="radio"
        columns={2}
        options={business.membership.cadences.map((c) => ({ value: c.id, label: c.label }))}
        error={errors.cadence}
      />
      <Field name="notes" label="Anything else?" optional error={errors.notes}>
        {(p) => <Textarea name="notes" maxLength={1000} {...p} />}
      </Field>
      <ConsentFields
        serviceText={business.consent.serviceText}
        marketingText={business.consent.marketingText}
        error={errors.serviceConsent}
      />
      <FormMessage message={message} />
      <div>
        <SubmitButton pending={pending} className="w-full sm:w-auto">
          Register interest
        </SubmitButton>
      </div>
    </form>
  );
}
