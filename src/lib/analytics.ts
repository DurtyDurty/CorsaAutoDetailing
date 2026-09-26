"use client";

/**
 * Client analytics adapter. Providers: "none" (default), "console" (dev),
 * "plausible" (cookieless; loads only when NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible).
 *
 * Only allow-listed, non-personal properties are ever sent. Names, emails,
 * phone numbers, addresses, notes and photos are never accepted here.
 */

export type AnalyticsEvent =
  | "service_viewed"
  | "pricing_vehicle_selected"
  | "lead_form_started"
  | "lead_form_submitted"
  | "membership_interest_submitted"
  | "contact_clicked";

const ALLOWED_PROPS = new Set([
  "service",
  "vehicle_category",
  "form",
  "step",
  "method",
  "lead_type",
  "mode",
  "zip_eligibility",
]);

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Props }) => void;
  }
}

function sanitize(props: Props | undefined): Props | undefined {
  if (!props) return undefined;
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(k)) continue;
    if (typeof v === "string" && (v.includes("@") || v.length > 60)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "none";
  const safe = sanitize(props);
  if (provider === "plausible") {
    window.plausible?.(event, safe ? { props: safe } : undefined);
  } else if (provider === "console") {
    console.info("[analytics]", event, safe ?? {});
  }
}
