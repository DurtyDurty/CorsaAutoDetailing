"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { FormResult } from "@/app/actions/leads";
import { track, type AnalyticsEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/* ---------- meta / anti-spam ---------- */

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old browsers; still a valid v4 shape.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Hidden fields every lead form carries: a stable idempotency key (so a retry
 * after a network failure cannot create a duplicate), a honeypot, and sanitised
 * attribution. Rendered only on the client so the key is unique per visitor.
 */
export function FormMeta() {
  const wrap = useRef<HTMLDivElement>(null);
  const honeyId = useId();
  // Fill the hidden fields after mount by writing to the DOM directly: the
  // values are per-visitor and must not be rendered on the server.
  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const set = (name: string, value: string) => {
      const el = root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (el && !el.value) el.value = value;
    };
    const params = new URLSearchParams(window.location.search);
    set("idempotencyKey", newKey());
    set("landingPath", window.location.pathname);
    set("referrer", document.referrer);
    set("utmSource", params.get("utm_source")?.slice(0, 120) ?? "");
    set("utmMedium", params.get("utm_medium")?.slice(0, 120) ?? "");
    set("utmCampaign", params.get("utm_campaign")?.slice(0, 120) ?? "");
  }, []);
  return (
    <div ref={wrap} hidden>
      {/*
        No `value`/`defaultValue` on purpose: for type="hidden" the value attribute
        IS the value, so React re-applying it on every render would wipe what the
        effect wrote. With no value prop React leaves the DOM alone.
      */}
      <input type="hidden" name="idempotencyKey" />
      <input type="hidden" name="landingPath" />
      <input type="hidden" name="referrer" />
      <input type="hidden" name="utmSource" />
      <input type="hidden" name="utmMedium" />
      <input type="hidden" name="utmCampaign" />
      {/* Honeypot: hidden from users and assistive tech, excluded from the tab order. */}
      <label htmlFor={honeyId}>Leave this field empty</label>
      <input id={honeyId} type="text" name="website" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/* ---------- hook: submit + redirect + analytics ---------- */

const NO_ERRORS: Record<string, string> = Object.freeze({}) as Record<string, string>;

export function useLeadForm(
  action: (prev: FormResult | null, fd: FormData) => Promise<FormResult>,
  opts: { formName: string; submittedEvent?: AnalyticsEvent; leadType: string },
) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (state?.status === "ok" && state.redirectTo) {
      track(opts.submittedEvent ?? "lead_form_submitted", { form: opts.formName, lead_type: opts.leadType });
      router.push(state.redirectTo);
    }
  }, [state, router, opts.formName, opts.leadType, opts.submittedEvent]);

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track("lead_form_started", { form: opts.formName });
  };

  /**
   * Submit manually instead of via `<form action>`: React 19 resets uncontrolled
   * fields after a form action completes, which would wipe the user's input
   * whenever the server returns validation errors.
   */
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };

  // Stable reference: consumers compare `errors` by identity to detect new server results.
  const errors = state?.status === "invalid" ? state.fieldErrors : NO_ERRORS;
  const message =
    state && state.status !== "ok" && state.status !== "invalid"
      ? state.message
      : state?.status === "invalid"
        ? state.message
        : null;
  return { state, onSubmit, pending: pending || state?.status === "ok", errors, message, onStart };
}

/* ---------- field primitives ---------- */

interface FieldProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ name, label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-field={name}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="text-ink-muted font-normal"> (optional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; describedBy?: string },
) {
  const { invalid, describedBy, className, ...rest } = props;
  return (
    <input
      className={cn("field", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; describedBy?: string }) {
  const { invalid, describedBy, className, children, ...rest } = props;
  return (
    <select className={cn("field", className)} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...rest}>
      {children}
    </select>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; describedBy?: string },
) {
  const { invalid, describedBy, className, ...rest } = props;
  return (
    <textarea
      className={cn("field min-h-28", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );
}

/** Group of radio/checkbox choices rendered as bordered blocks. */
export function ChoiceGroup({
  legend,
  name,
  type,
  options,
  error,
  hint,
  defaultValue,
  onChange,
  columns = 1,
  required,
}: {
  legend: string;
  name: string;
  type: "radio" | "checkbox";
  options: { value: string; label: string; description?: string }[];
  error?: string;
  hint?: string;
  defaultValue?: string | string[];
  onChange?: (value: string) => void;
  columns?: 1 | 2 | 3;
  /** Radio groups only: native required so step gating can catch an empty choice. */
  required?: boolean;
}) {
  const id = useId();
  const errId = error ? `${id}-err` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const isChecked = (v: string) =>
    Array.isArray(defaultValue) ? defaultValue.includes(v) : defaultValue === v;
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={[errId, hintId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
      data-field={name}
    >
      <legend className="text-sm font-medium mb-1.5">{legend}</legend>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted -mt-1 mb-1">
          {hint}
        </p>
      )}
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input
              type={type}
              name={name}
              value={o.value}
              className={type}
              defaultChecked={isChecked(o.value)}
              required={type === "radio" ? required : undefined}
              onChange={() => onChange?.(o.value)}
            />
            <span>
              <span className="block font-medium leading-snug">{o.label}</span>
              {o.description && <span className="block text-sm text-ink-muted mt-0.5">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errId} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ConsentFields({
  serviceText,
  marketingText,
  error,
}: {
  serviceText: string;
  marketingText: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <label className="flex gap-3 items-start text-sm leading-relaxed">
        <input type="checkbox" name="serviceConsent" className="checkbox" aria-describedby={error ? `${id}-err` : undefined} />
        <span>
          {serviceText} <span className="text-error" aria-hidden="true">*</span>
        </span>
      </label>
      {error && (
        <p id={`${id}-err`} className="text-sm text-error -mt-1 ml-8" role="alert">
          {error}
        </p>
      )}
      <label className="flex gap-3 items-start text-sm leading-relaxed text-ink-muted">
        <input type="checkbox" name="marketingEmail" className="checkbox" />
        <span>{marketingText}</span>
      </label>
    </div>
  );
}

export function FormMessage({ message, tone = "error" }: { message: string | null; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-sm border px-4 py-3 text-sm",
        tone === "error" ? "border-error/40 bg-[#fbeeeb] text-error" : "border-line bg-white text-ink",
      )}
    >
      {message}
    </div>
  );
}

export function SubmitButton({ children, pending, className }: { children: ReactNode; pending?: boolean; className?: string }) {
  const status = useFormStatus();
  const busy = pending || status.pending;
  return (
    <Button type="submit" size="lg" disabled={busy} aria-busy={busy} className={className}>
      {busy ? "Sending…" : children}
    </Button>
  );
}
