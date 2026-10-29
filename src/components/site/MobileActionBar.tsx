"use client";

import { isPrelaunch, phoneLink, primaryCta, SMS_PREFILL, SMS_PREFILL_ES } from "@/config/business";
import { localePath, stripLang } from "@/i18n/dictionary";
import { useLang } from "@/i18n/use-lang";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { PhoneIcon, TextIcon } from "./icons";

/** The booking form's anchor on the pages that carry it (home and /book, in both languages). */
export const BOOKING_FORM_ID = "booking-form";

const button = "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border text-[0.95rem] font-semibold";

/**
 * Phones and tablets: Call, Text and Book, always at the bottom of the screen.
 * Where the page has the booking form, "Book" jumps to it instead of loading another page.
 * Taps on Call and Text are counted as Google Ads conversions by GoogleAdsTag.
 */
export function MobileActionBar() {
  const { lang, d, pathname } = useLang();
  const tel = phoneLink("tel");
  const sms = phoneLink("sms", lang === "es" ? SMS_PREFILL_ES : SMS_PREFILL);
  const base = stripLang(pathname);
  const hasForm = base === "/" || base === "/book" || base.startsWith("/request");
  // Before launch "Book" is the launch-list signup.
  const bookHref = isPrelaunch ? primaryCta().href : hasForm ? `#${BOOKING_FORM_ID}` : `${localePath(lang, "/book")}`;

  return (
    <>
      {/* Keeps the end of the page clear of the bar. */}
      <div aria-hidden="true" className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] bg-night lg:hidden" />
      <nav
        aria-label={d.bar.aria}
        lang={d.htmlLang}
        className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-white/10 bg-night/95 px-3 pt-2.5 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {tel && (
          <a href={tel} onClick={() => track("contact_clicked", { method: "phone" })} className={cn(button, "border-chalk/30 text-chalk")}>
            <PhoneIcon />
            {d.bar.call}
          </a>
        )}
        {sms && (
          <a href={sms} onClick={() => track("contact_clicked", { method: "text" })} className={cn(button, "border-chalk/30 text-chalk")}>
            <TextIcon />
            {d.bar.text}
          </a>
        )}
        <a href={bookHref} className={cn(button, "border-apex-deep bg-apex-deep text-white")}>
          {d.bar.book}
        </a>
      </nav>
    </>
  );
}
