import type { Metadata } from "next";
import { business } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { PricingTable } from "@/components/site/PricingTable";
import { Faq } from "@/components/site/Faq";
import { SERVICES_FAQ } from "@/content/faq";
import { ServiceViewTracker } from "@/components/site/ServiceViewTracker";

export const metadata: Metadata = {
  title: "Services & pricing",
  description:
    "Exterior Wash & Protect and Maintenance Clean packages with planned starting prices by vehicle type. What's included, what isn't, and how quotes work.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <ServiceViewTracker />
      <PageHero
        eyebrow="Services & pricing"
        title="Clear scope, clear prices, no surprises."
        lede="Two packages for daily drivers in routine condition. Everything is hand work at your location. Anything outside the package is quoted separately and only with your approval."
      />

      <Section tone="white">
        <div className="grid gap-6 lg:grid-cols-2">
          {business.services.map((s) => (
            <article key={s.id} id={s.id} className="border border-line rounded-md p-6 sm:p-8 flex flex-col scroll-mt-24">
              <h2 className="font-display text-2xl sm:text-3xl">{s.name}</h2>
              <p className="mt-2 text-ink-muted">{s.description}</p>
              <h3 className="mt-6 text-xs uppercase tracking-[0.18em] font-semibold text-champagne-deep">Included</h3>
              <ul className="mt-3 space-y-2">
                {s.includes.map((i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden="true" className="text-champagne-deep">
                      —
                    </span>
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <ButtonLink href={`/request?service=${s.id}`} variant="secondary">
                  Request {s.name}
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading eyebrow="Pricing" title="By vehicle type." />
        <div className="mt-10">
          <PricingTable />
        </div>
      </Section>

      <Section tone="white">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHeading
              eyebrow="Not included"
              title="What these packages don't cover."
              lede="These packages are built for routine soil. The following needs a review and a separate quote where we can offer it:"
            />
            <ul className="mt-6 grid sm:grid-cols-2 gap-2">
              {business.exclusions.map((e) => (
                <li key={e} className="border border-line rounded-sm px-4 py-3 text-sm">
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Custom quotes" title="When we quote individually." />
            <ul className="mt-6 space-y-3 text-ink-muted">
              {business.customQuoteConditions.map((c) => (
                <li key={c} className="flex gap-3">
                  <span aria-hidden="true" className="text-champagne-deep">
                    —
                  </span>
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">
              We never add condition or travel charges on our own. Any extra work and its cost is agreed with you before service.
            </p>
            <h3 className="mt-10 text-xs uppercase tracking-[0.18em] font-semibold text-champagne-deep">Not offered at launch</h3>
            <p className="mt-3 text-ink-muted text-sm">
              {business.futureServices.join(", ")}. These are future plans, not bookable services.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="ivory">
        <SectionHeading eyebrow="Questions" title="Service details." />
        <div className="mt-10 max-w-3xl">
          <Faq items={SERVICES_FAQ} />
        </div>
      </Section>
    </>
  );
}
