"use client";

import Link from "next/link";
import { business, isPrelaunch } from "@/config/business";
import { formatHour, localePath } from "@/i18n/dictionary";
import { useLang } from "@/i18n/use-lang";
import { Container } from "@/components/ui/Section";
import { formatPhone } from "@/lib/utils";
import { Wordmark } from "./Wordmark";
import { MORE_PAGES } from "./nav";
import { ContactLink } from "./ContactLink";
import { VeteranBadge } from "./VeteranBadge";

const YEAR = new Date().getFullYear();

/** Phone, hours, service area and socials, then legal links. Same footer in both languages. */
export function SiteFooter() {
  const { lang, d } = useLang();
  const { contact } = business;
  const towns = business.serviceAreas.communities.filter((c) => c.page);
  const { start, end } = business.scheduling.workHours;
  const social = [
    contact.social.instagram && { href: contact.social.instagram, label: "Instagram" },
    contact.social.facebook && { href: contact.social.facebook, label: "Facebook" },
  ].filter((s): s is { href: string; label: string } => Boolean(s));
  const head = "text-xs font-semibold uppercase tracking-[0.16em] text-apex";

  return (
    <footer lang={d.htmlLang} className="bg-night text-chalk on-dark">
      <div className="stripe-divider" aria-hidden="true" />
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.2fr_1.25fr_1fr_0.9fr]">
        <div>
          <Wordmark onDark href={localePath(lang, "/")} />
          <p className="mt-4 max-w-sm leading-relaxed text-chalk/75">{d.footer.tagline}</p>
          <VeteranBadge size="sm" className="mt-5" />
          <p className="mt-3 text-sm text-chalk/75" lang="es">
            Se habla español
          </p>
        </div>
        <div>
          <h2 className={head}>{d.footer.contact}</h2>
          <ul className="mt-4 space-y-2.5 text-chalk/85">
            {contact.phone && (
              <li>
                <ContactLink method="phone" href={`tel:+1${contact.phone.replace(/\D/g, "").slice(-10)}`} className="font-semibold hover:text-apex">
                  {formatPhone(contact.phone.replace(/\D/g, "").slice(-10))}
                </ContactLink>
              </li>
            )}
            {contact.email && (
              <li>
                <ContactLink method="email" href={`mailto:${contact.email}`} className="hover:text-apex">
                  {/* Wraps only after the @ in a narrow column, never inside the domain. */}
                  {contact.email.split("@")[0]}@<wbr />
                  {contact.email.split("@").slice(1).join("@")}
                </ContactLink>
              </li>
            )}
          </ul>
          <h2 className={`${head} mt-7`}>{d.footer.hours}</h2>
          <p className="mt-3 text-chalk/85">{d.footer.hoursValue(formatHour(start, lang), formatHour(end, lang))}</p>
        </div>
        <div>
          <h2 className={head}>{d.footer.area}</h2>
          <ul className="mt-4 space-y-2 text-chalk/85">
            {towns.map((t) => (
              <li key={t.slug}>
                <Link href={localePath(lang, `/service-areas/${t.slug}`)} className="hover:text-apex">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {social.length > 0 && (
            <>
              <h2 className={head}>{d.footer.follow}</h2>
              <ul className="mt-4 space-y-2.5">
                {social.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} rel="noopener" className="text-chalk/85 hover:text-apex">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {lang === "en" && (
            <>
              <h2 className={`${head} ${social.length > 0 ? "mt-7" : ""}`}>{d.footer.explore}</h2>
              <ul className="mt-4 space-y-2.5">
                {MORE_PAGES.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-chalk/85 hover:text-apex">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {isPrelaunch && (
                  <li>
                    <Link href="/#launch-list" className="text-chalk/85 hover:text-apex">
                      Get launch updates
                    </Link>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </Container>
      <div className="border-t border-line-dark">
        <Container className="flex flex-col gap-3 py-5 text-sm text-chalk/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {YEAR} {business.brand.name}. {d.footer.serving(business.serviceAreas.region)}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-apex">
              {d.footer.privacy}
            </Link>
            <Link href="/terms" className="hover:text-apex">
              {d.footer.terms}
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
