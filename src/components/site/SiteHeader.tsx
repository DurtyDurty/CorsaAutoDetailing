import { primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav";

export function SiteHeader() {
  const cta = primaryCta();
  return (
    <header className="sticky top-0 z-40 bg-asphalt/95 backdrop-blur text-chalk on-dark">
      <Container className="relative flex items-center justify-between gap-6 h-16 sm:h-[4.5rem]">
        <Wordmark onDark />
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-5 xl:gap-8">
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
        <div className="hidden lg:block">
          <ButtonLink href={cta.href} size="sm" variant="apex">
            {cta.label}
          </ButtonLink>
        </div>
        <MobileNav cta={cta} />
      </Container>
      <div className="kerb h-0.5 opacity-70" aria-hidden="true" />
    </header>
  );
}
