"use client";

import { usePathname } from "next/navigation";
import { isPrelaunch, phoneLink, primaryCta, SMS_PREFILL } from "@/config/business";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** The booking form's anchor on /book and /request. */
export const BOOKING_FORM_ID = "booking-form";

const button = "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-sm border text-[0.95rem] font-semibold";

/**
 * Phones and tablets: Call, Text and Book, always at the bottom of the screen.
 * On the booking pages "Book" jumps to the form instead of reloading the page.
 * Taps on Call and Text are counted as Google Ads conversions by GoogleAdsTag.
 */
export function MobileActionBar() {
  const pathname = usePathname();
  const tel = phoneLink("tel");
  const sms = phoneLink("sms", SMS_PREFILL);
  const onBookingPage = pathname === "/book" || pathname.startsWith("/request");
  // Before launch "Book" is the launch-list signup.
  const bookHref = isPrelaunch ? primaryCta().href : onBookingPage ? `#${BOOKING_FORM_ID}` : "/book";

  return (
    <>
      {/* Keeps the end of the page clear of the bar. */}
      <div aria-hidden="true" className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:hidden" />
      <nav
        aria-label="Call, text or book"
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line-dark bg-asphalt/95 px-3 pt-2.5 backdrop-blur"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {tel && (
          <a href={tel} onClick={() => track("contact_clicked", { method: "phone" })} className={cn(button, "border-chalk/35 text-chalk")}>
            <PhoneIcon />
            Call
          </a>
        )}
        {sms && (
          <a href={sms} onClick={() => track("contact_clicked", { method: "text" })} className={cn(button, "border-chalk/35 text-chalk")}>
            <TextIcon />
            Text
          </a>
        )}
        <a href={bookHref} className={cn(button, "border-apex-deep bg-apex-deep text-white")}>
          Book
        </a>
      </nav>
    </>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
