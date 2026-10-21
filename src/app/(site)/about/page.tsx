import type { Metadata } from "next";
import { business, isPrelaunch, primaryCta } from "@/config/business";
import { photos } from "@/config/photos";
import { ButtonLink } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { VeteranBadge } from "@/components/site/VeteranBadge";

export const metadata: Metadata = {
  title: "About",
  description: `${business.brand.name} is a ${business.owner.veteranOwned ? "veteran-owned " : ""}mobile auto detailing business serving Clay County and Jacksonville, Florida.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const cta = primaryCta();
  return (
    <>
      <PageHero
        eyebrow="About"
        title={`About ${business.brand.name}`}
        lede={`${business.brand.name} is a new, ${business.owner.veteranOwned ? "veteran-owned " : ""}mobile detailing business serving ${business.serviceAreas.region}. You don't need to provide water or power, just a place to park.`}
        photo={photos.onSiteSetup}
      >
        {business.owner.veteranOwned && <VeteranBadge />}
      </PageHero>

      <Section tone="white">
        <SectionHeading title="What you can expect from us" />
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {[
            {
              t: "Straight answers",
              b: "Starting prices are labeled as starting prices. A request isn't an appointment until we confirm it. If we can't reach your area yet, we'll say so.",
            },
            {
              t: "Your approval first",
              b: "No condition or travel charges appear on their own. Anything beyond the package is explained and agreed before we touch the car.",
            },
            {
              t: "Deliberate growth",
              b: `A short list of packages, clear starting prices, and a service area we can reach well: ${business.serviceAreas.region}. Film, tint and professional coatings are ideas for later, not promises for now.`,
            },
          ].map((item) => (
            <div key={item.t} className="border-t-2 border-apex-deep pt-5">
              <h3 className="font-semibold text-lg">{item.t}</h3>
              <p className="mt-2 text-ink-muted leading-relaxed">{item.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h2 className="font-display text-3xl text-balance">{isPrelaunch ? "Want to hear when we open?" : "Ready for a detail?"}</h2>
          <ButtonLink href={cta.href} variant="apex" size="lg">
            {cta.label}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
