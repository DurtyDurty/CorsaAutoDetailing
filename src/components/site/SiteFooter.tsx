import Link from "next/link";
import { business, isPrelaunch } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";
import { NAV_LINKS } from "./nav";
import { formatPhone } from "@/lib/utils";
import { ContactLink } from "./ContactLink";
import { VeteranBadge } from "./VeteranBadge";

export function SiteFooter() {
  const { contact } = business;
  const hasContact = contact.email || contact.phone;
  const hasSocial = contact.social.instagram || contact.social.facebook;

  return (
    <footer className="bg-asphalt text-chalk on-dark pb-24 lg:pb-0">
      <div className="kerb h-[3px] opacity-80" aria-hidden="true" />
      <Container className="py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark onDark />
          <p className="mt-4 text-chalk/75 max-w-sm leading-relaxed">
            Interior and exterior car detailing at your home or workplace. {business.brand.tagline}
          </p>
          <VeteranBadge size="sm" className="mt-5" />
        </div>
        <nav aria-label="Footer">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-chalk/85 hover:text-apex">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={isPrelaunch ? "/#launch-list" : "/request"} className="text-chalk/85 hover:text-apex">
                {isPrelaunch ? "Get launch updates" : "Request an appointment"}
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex">Get in touch</h2>
          <ul className="mt-4 space-y-2.5 text-chalk/85">
            {contact.email && (
              <li>
                <ContactLink method="email" href={`mailto:${contact.email}`}>
                  {contact.email}
                </ContactLink>
              </li>
            )}
            {contact.phone && (
              <li>
                <ContactLink method="phone" href={`tel:+1${contact.phone.replace(/\D/g, "")}`}>
                  {formatPhone(contact.phone.replace(/\D/g, ""))}
                </ContactLink>
              </li>
            )}
            {!hasContact && (
              <li>
                <Link href="/contact" className="hover:text-apex">
                  Send us a message
                </Link>
              </li>
            )}
            {contact.responseHours && <li className="text-sm text-chalk/65">Replies: {contact.responseHours}</li>}
            {hasSocial && (
              <li className="flex gap-4 pt-1">
                {contact.social.instagram && (
                  <a href={contact.social.instagram} rel="noopener" className="hover:text-apex">
                    Instagram
                  </a>
                )}
                {contact.social.facebook && (
                  <a href={contact.social.facebook} rel="noopener" className="hover:text-apex">
                    Facebook
                  </a>
                )}
              </li>
            )}
          </ul>
        </div>
      </Container>
      <div className="border-t border-line-dark">
        <Container className="py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-chalk/60">
          <p>© {new Date().getFullYear()} {business.brand.name}. Serving {business.serviceAreas.region}.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span lang="es">Se habla español</span>
            <Link href="/privacy" className="hover:text-apex">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-apex">
              Service terms
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
