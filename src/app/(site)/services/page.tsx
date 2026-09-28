import type { Metadata } from "next";
import { business } from "@/config/business";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { PackageCards } from "@/components/site/PackageCards";
import { AdditionalServices } from "@/components/site/AdditionalServices";
import { PricingDisclosures } from "@/components/site/Disclosures";
import { CareJourney } from "@/components/site/CareJourney";
import { BusinessJsonLd } from "@/components/site/JsonLd";
import { Faq } from "@/components/site/Faq";
import { SERVICES_FAQ } from "@/content/faq";
import { ServiceViewTracker } from "@/components/site/ServiceViewTracker";

export const metadata: Metadata = {
  title: "Detailing packages & pricing",
  description:
    "Corsa Essential from $120 and Signature from $275. Interior and exterior car detailing at your home or work in Clay County, St. Johns and Jacksonville.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <BusinessJsonLd />
      <ServiceViewTracker />
      <PageHero
        eyebrow="Packages & pricing"
        title="Two packages. Clear starting prices."
        lede="Interior and exterior car detailing, done by hand at your home or workplace. Choose your vehicle size to see your starting price; the final price is confirmed at an in-person inspection before any work begins."
      />

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
