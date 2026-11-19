import type { Metadata } from "next";
import Link from "next/link";
import { business } from "@/config/business";
import { servicePages } from "@/content/service-pages";
import { photos } from "@/config/photos";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { PackageGrid } from "@/components/site/PackageGrid";
import { InstantQuote } from "@/components/site/InstantQuote";
import { AdditionalServices } from "@/components/site/AdditionalServices";
import { PricingDisclosures } from "@/components/site/Disclosures";
import { CorsaClub } from "@/components/home/CorsaClub";
import { BusinessJsonLd } from "@/components/site/JsonLd";
import { Faq } from "@/components/site/Faq";
import { SERVICES_FAQ } from "@/content/faq";
import { ServiceViewTracker } from "@/components/site/ServiceViewTracker";
import { groupStartingPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Detailing packages & pricing",
  description:
    `Interior and exterior detailing packages from $${groupStartingPrice("popular")}, priced by vehicle size, plus the Corsa Club maintenance plan. Mobile car detailing at your home or work in Clay County, St. Johns and Jacksonville.`,
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <BusinessJsonLd />
      <ServiceViewTracker />
      <PageHero
        eyebrow="Packages & pricing"
        title="Detailing packages and prices"
        lede="Interior and exterior car detailing in one visit, done by hand at your home or workplace. Every package shows its starting price, and full packages are priced by vehicle size; the final price is confirmed at an in-person inspection before any work begins."
        photo={photos.stingerFront}
      />

      <Section tone="white" id="quote" className="scroll-mt-20">
        <SectionHeading
          title="Get your price in seconds"
          lede="Pick a package to see its starting price. No contact details needed."
        />
        <InstantQuote className="mt-10 max-w-3xl" />
      </Section>

      <Section tone="night" id="packages">
        <PackageGrid lang="en" headingLevel="h2" />
      </Section>
      <Section tone="chalk" className="!py-10">
        <PricingDisclosures />
      </Section>

      <Section tone="white">
        <SectionHeading
          title="Additional services"
          lede="For vehicles that need more than a package covers. Each is priced after we see the vehicle and only added with your approval."
        />
        <div className="mt-10">
          <AdditionalServices />
        </div>
        <div className="mt-10 max-w-2xl">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-apex-deep">Quoted individually</h3>
          <ul className="mt-3 space-y-2 text-ink-muted">
            {business.customQuoteConditions.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 -skew-x-[20deg] bg-apex-deep" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="chalk">
        <SectionHeading title="Services in detail" lede="What we do for interiors, paint, pet hair and headlights, and how each one is priced." />
        <ul className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {servicePages().map((p) => (
            <li key={p.slug}>
              <Link href={`/services/${p.slug}`} className="group flex min-h-14 items-center justify-between gap-4 bg-white px-5 py-4 font-medium hover:text-apex-deep">
                {p.name}
                <span aria-hidden="true" className="text-apex-deep transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CorsaClub lang="en" />

      <Section tone="chalk">
        <SectionHeading title="Service questions" />
        <div className="mt-10 max-w-3xl">
          <Faq items={SERVICES_FAQ} />
        </div>
      </Section>
    </>
  );
}
