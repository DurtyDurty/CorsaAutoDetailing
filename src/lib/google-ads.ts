"use client";

import { business } from "@/config/business";

/**
 * Google Ads conversions sent from the browser through the Google tag
 * (components/site/GoogleAdsTag). Nothing personal is sent: the lead id is an
 * opaque dedupe key, so a reload or a resubmitted form counts once.
 *
 * The server still uploads "Booking confirmed" separately (lib/ads) once the
 * owner confirms the job; that one is a secondary conversion.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const ads = business.analytics.googleAds;

function sendTo(label: string | null): string | null {
  return ads.tagId && label ? `${ads.tagId}/${label}` : null;
}

/** A booking request was saved (call only after the server said so). */
export function reportBookingRequest(leadId: string): void {
  const target = sendTo(ads.leadLabel);
  if (!target || typeof window === "undefined") return;
  window.gtag?.("event", "conversion", { send_to: target, transaction_id: leadId });
}

/** A visitor tapped a tel: or sms: link. */
export function reportContactTap(method: "call" | "text"): void {
  const target = sendTo(ads.callLabel);
  if (!target || typeof window === "undefined") return;
  window.gtag?.("event", "conversion", { send_to: target, method });
}
