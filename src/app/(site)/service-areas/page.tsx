import type { Metadata } from "next";
import { business, primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { ZipChecker } from "@/components/site/ZipChecker";

export const metadata: Metadata = {
  title: `Service areas — ${business.serviceAreas.region}`,
  description:
    "Mobile detailing in Middleburg, Fleming Island and Green Cove Springs, with selected Orange Park locations. Check whether we can reach your ZIP.",
  alternates: { canonical: "/service-areas" },
};

export default function ServiceAreasPage() {
  const cta = primaryCta();
  const core = business.serviceAreas.communities.filter((c) => c.coverage === "core");
  const confirm = business.serviceAreas.communities.filter((c) => c.coverage === "confirm");

  return (
    <>
      <PageHero
        eyebrow="Service areas"
        title={`Where we're starting: ${business.serviceAreas.region}.`}
        lede="A deliberately small footprint so each visit gets the time it deserves. We'll expand once we've earned it."
      />

      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12">
          <div>
            <SectionHeading eyebrow="Core coverage" title="Communities we serve fully." />
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {core.map((c) => (
                <li key={c.slug} className="py-5">
                  <h3 className="font-medium text-lg">{c.name}</h3>
                  <p className="mt-1 text-ink-muted">{c.blurb}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Travel confirmation" title="Selected locations." />
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {confirm.map((c) => (
                <li key={c.slug} className="py-5">
                  <h3 className="font-medium text-lg">{c.name}</h3>
                  <p className="mt-1 text-ink-muted">{c.blurb}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">
              Other parts of Clay County and Jacksonville may be reachable depending on the day&rsquo;s route. We confirm travel for every Jacksonville address when we review the request, and we&rsquo;ll tell you plainly if we can&rsquo;t get to you yet. There are no travel surcharges — if a location doesn&rsquo;t work, we simply say so.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="chalk">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <SectionHeading
            eyebrow="ZIP check"
            title="Can we reach you?"
            lede="Enter your ZIP for an instant, informal answer. Final eligibility is confirmed when we review your request."
          />
          <ZipChecker />
        </div>
      </Section>

      <Section tone="dark">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h2 className="font-display text-3xl text-balance">Live nearby? Get on the list.</h2>
          <ButtonLink href={cta.href} variant="apex" size="lg">
            {cta.label}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
