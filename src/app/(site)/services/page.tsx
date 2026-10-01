import type { Metadata } from "next";
import { business } from "@/config/business";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { PackageCards } from "@/components/site/PackageCards";
import { InstantQuote } from "@/components/site/InstantQuote";
import { AdditionalServices } from "@/components/site/AdditionalServices";
import { PricingDisclosures } from "@/components/site/Disclosures";
import { CareJourney } from "@/components/site/CareJourney";
import { BusinessJsonLd } from "@/components/site/JsonLd";
import { Faq } from "@/components/site/Faq";
import { SERVICES_FAQ } from "@/content/faq";
import { ServiceViewTracker } from "@/components/site/ServiceViewTracker";
import { groupStartingPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Detailing packages & pricing",
  description:
    `Full details from $${groupStartingPrice("popular")}, interior and exterior packages from $${Math.min(groupStartingPrice("interior"), groupStartingPrice("exterior"))}, plus monthly maintenance. Mobile car detailing at your home or work in Clay County, St. Johns and Jacksonville.`,
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <BusinessJsonLd />
      <ServiceViewTracker />
      <PageHero
        eyebrow="Packages & pricing"
        title="Every package. Clear starting prices."
        lede="Full, interior and exterior car detailing, done by hand at your home or workplace. Every package has one starting price; the final price is confirmed at an in-person inspection before any work begins."
      />

      <Section tone="white" id="quote" className="scroll-mt-20">
        <SectionHeading
          eyebrow="Instant quote"
          title="Get your price in seconds."
          lede="Pick a package to see its starting price. No contact details needed."
        />
        <InstantQuote className="mt-10 max-w-3xl" />
      </Section>

      <Section tone="chalk">
        <PackageCards headingLevel="h2" />
        <PricingDisclosures className="mt-12" />
      </Section>

      <Section tone="white">
        <SectionHeading
          eyebrow="Add-ons"
          title="Additional services"
          lede="For vehicles that need more than a package covers. Each is priced after we see the vehicle and only added with your approval."
        />
        <div className="mt-10">
          <AdditionalServices />
        </div>
        <div className="mt-10 max-w-2xl">
          <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Quoted individually</h3>
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

      <CareJourney />

      <Section tone="chalk">
        <SectionHeading eyebrow="Questions" title="Service details." />
        <div className="mt-10 max-w-3xl">
          <Faq items={SERVICES_FAQ} />
        </div>
      </Section>
    </>
  );
}
