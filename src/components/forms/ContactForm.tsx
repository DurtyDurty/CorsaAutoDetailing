"use client";

import { submitContact } from "@/app/actions/leads";
import { business } from "@/config/business";
import {
  ConsentFields,
  Field,
  FormMessage,
  FormMeta,
  SubmitButton,
  Textarea,
  TextInput,
  useLeadForm,
} from "./primitives";

export function ContactForm() {
  const { onSubmit, pending, errors, message, onStart } = useLeadForm(submitContact, {
    formName: "contact",
    leadType: "contact",
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" onFocus={onStart} noValidate aria-label="Contact form">
      <FormMeta />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="firstName" label="First name" error={errors.firstName}>
          {(p) => <TextInput name="firstName" autoComplete="given-name" required {...p} />}
        </Field>
        <Field name="phone" label="Phone" optional error={errors.phone}>
          {(p) => <TextInput name="phone" type="tel" autoComplete="tel" {...p} />}
        </Field>
      </div>
      <Field name="email" label="Email" error={errors.email}>
        {(p) => <TextInput name="email" type="email" autoComplete="email" required {...p} />}
      </Field>
      <Field name="message" label="How can we help?" error={errors.message}>
        {(p) => <Textarea name="message" required maxLength={2000} {...p} />}
      </Field>
      <ConsentFields
        serviceText={business.consent.serviceText}
        marketingText={business.consent.marketingText}
        error={errors.serviceConsent}
      />
      <FormMessage message={message} />
      <div>
        <SubmitButton pending={pending} className="w-full sm:w-auto">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
