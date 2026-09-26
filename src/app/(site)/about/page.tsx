import type { Metadata } from "next";
import { business, primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "About",
  description: `${business.brand.name} is a veteran-owned mobile detailing startup in Clay County, Florida, founded by retired U.S. Navy Chief ${business.owner.name}.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const cta = primaryCta();
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A small, careful company. On purpose."
        lede={`${business.brand.name} is a new, ${business.owner.veteranOwned ? "veteran-owned " : ""}mobile detailing business serving ${business.serviceAreas.region}.`}
      />

      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12">
          <div>
            <SectionHeading eyebrow="The owner" title={business.owner.name} />
            <p className="mt-3 text-ink-muted">U.S. Navy Chief, retired · 20 years of service</p>
          </div>
          <div className="space-y-5 text-lg leading-relaxed">
            {business.owner.bio.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="chalk">
        <SectionHeading
          eyebrow="How we work"
          title="What you can expect from us."
        />
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {[
            {
              t: "Straight answers",
              b: "Planned prices are labeled as planned. Requests aren't called appointments. If we can't reach your area yet, we'll say so.",
            },
            {
              t: "Your approval first",
              b: "No condition or travel charges appear on their own. Anything beyond the package is explained and agreed before we touch the car.",
            },
            {
              t: "Deliberate growth",
              b: "We're starting with two packages and four communities. Studio services like film and tint are ideas for later, not promises for now.",
            },
          ].map((item) => (
            <div key={item.t} className="border-t border-asphalt pt-5">
              <h3 className="font-medium text-lg">{item.t}</h3>
              <p className="mt-2 text-ink-muted leading-relaxed">{item.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h2 className="font-display text-3xl text-balance">Want to hear when we open?</h2>
          <ButtonLink href={cta.href} variant="apex" size="lg">
            {cta.label}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
