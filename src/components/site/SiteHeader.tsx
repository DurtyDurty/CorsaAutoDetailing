import { primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav";

export function SiteHeader() {
  const cta = primaryCta();
  return (
    <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur border-b border-line">
      <Container className="flex items-center justify-between gap-6 h-16 sm:h-[4.5rem]">
        <Wordmark />
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[0.95rem] text-ink hover:text-champagne-deep">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden lg:block">
          <ButtonLink href={cta.href} size="sm">
            {cta.label}
          </ButtonLink>
        </div>
        <MobileNav cta={cta} />
      </Container>
    </header>
  );
}
