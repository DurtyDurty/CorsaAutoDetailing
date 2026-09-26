import Script from "next/script";
import { business } from "@/config/business";

/** Loads a third-party analytics script only when explicitly configured. */
export function AnalyticsScript() {
  if (business.analytics.provider !== "plausible" || !business.analytics.plausibleDomain) return null;
  return (
    <Script
      defer
      data-domain={business.analytics.plausibleDomain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
