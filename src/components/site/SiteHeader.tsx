"use client";

import Link from "next/link";
import { business, phoneLink, SMS_PREFILL, SMS_PREFILL_ES } from "@/config/business";
import { localePath } from "@/i18n/dictionary";
import { otherLanguageHref } from "@/i18n/routes";
import { useLang } from "@/i18n/use-lang";
import { formatPhone } from "@/lib/utils";
import { Wordmark } from "./Wordmark";
import { MobileNav } from "./MobileNav";
import { navLinks } from "./nav";
import { PhoneIcon, TextIcon } from "./icons";

/**
 * Logo · page links (wide screens) · EN/ES · Message us (SMS, prefilled) · tap-to-call (phones) · menu.
 * Taps on the SMS and call links count as Google Ads "Call or text tap" conversions (GoogleAdsTag).
 */
export function SiteHeader() {
  const { lang, d, pathname } = useLang();
  const tel = phoneLink("tel");
  const sms = phoneLink("sms", lang === "es" ? SMS_PREFILL_ES : SMS_PREFILL);
  const links = navLinks(lang);
  const other = lang === "es" ? "en" : "es";

  return (
    <header lang={d.htmlLang} className="sticky top-0 z-40 border-b border-white/5 bg-night/90 text-chalk backdrop-blur on-dark">
      <div className="relative mx-auto flex h-16 w-full max-w-[88rem] items-center justify-between gap-2 px-4 sm:h-[4.5rem] sm:gap-4 sm:px-8">
        <Wordmark onDark href={localePath(lang, "/")} className="shrink-0" />
        <nav aria-label={d.nav.primary} className="hidden items-center gap-7 xl:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap py-2 text-[0.95rem] font-medium text-chalk/80 hover:text-chalk">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href={otherLanguageHref(pathname, other)}
            hrefLang={other}
            lang={other}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-chalk/25 px-2.5 text-xs font-bold uppercase tracking-[0.1em] text-chalk hover:border-chalk/60"
          >
            <span className="sm:hidden">{other.toUpperCase()}</span>
            <span className="hidden sm:inline">{d.header.switchTo}</span>
            {/* Spoken after the visible label, so the accessible name still starts with what sighted users see. */}
            <span className="sr-only">: {d.header.switchToAria}</span>
          </Link>
          {sms && (
            <a
              href={sms}
              className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-apex-deep px-3 text-sm font-semibold text-white hover:bg-[#a51824] sm:px-4"
            >
              <TextIcon />
              <span className="sr-only sm:not-sr-only">{d.header.messageUs}</span>
            </a>
          )}
          {tel && business.contact.phone && (
            <a
              href={tel}
              aria-label={d.header.callAria(formatPhone(business.contact.phone.replace(/\D/g, "").slice(-10)))}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-chalk/25 text-chalk hover:border-chalk/60 max-[359px]:hidden lg:hidden"
            >
              <PhoneIcon />
            </a>
          )}
          {tel && business.contact.phone && (
            <a href={tel} className="hidden whitespace-nowrap text-sm font-semibold text-chalk/85 hover:text-chalk lg:inline">
              {business.contact.phone}
            </a>
          )}
          <MobileNav links={links} d={d} />
        </div>
      </div>
      <div className="stripe-divider opacity-80" aria-hidden="true" />
    </header>
  );
}
