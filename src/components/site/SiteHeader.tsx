import { primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "./Wordmark";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav";
import { VeteranBadge } from "./VeteranBadge";

/**
 * Logo · nav links · CTA · veteran badge (far right).
 * Slightly wider than page content so the full row fits; below 1280px the links move into the Menu.
 */
export function SiteHeader() {
  const cta = primaryCta();
  return (
    <header className="sticky top-0 z-40 bg-asphalt/95 backdrop-blur text-chalk on-dark">
      <div className="relative mx-auto flex w-full max-w-[88rem] items-center justify-between gap-6 px-5 sm:px-8 h-16 sm:h-[4.5rem]">
        <Wordmark onDark className="shrink-0" />
        <nav aria-label="Primary" className="hidden xl:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative whitespace-nowrap py-2 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-chalk/80 hover:text-chalk after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-apex after:transition-transform hover:after:scale-x-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 xl:gap-4">
          <div className="hidden lg:block">
            <ButtonLink href={cta.href} size="sm" variant="apex">
              {cta.label}
            </ButtonLink>
          </div>
          <VeteranBadge size="sm" flagOnlyBelowWide />
          <MobileNav cta={cta} />
        </div>
      </div>
      <div className="kerb h-0.5 opacity-70" aria-hidden="true" />
    </header>
  );
}
