import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business, absoluteUrl, primaryCta } from "@/config/business";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { PackageCards } from "@/components/site/PackageCards";
import { ZipChecker } from "@/components/site/ZipChecker";

/** One SEO landing page per served community (business.serviceAreas.communities with `page: true`). */

const towns = business.serviceAreas.communities.filter((c) => c.page);

export const dynamicParams = false;

export function generateStaticParams() {
  return towns.map((c) => ({ slug: c.slug }));
}

function townBySlug(slug: string) {
  return towns.find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/service-areas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const town = townBySlug(slug);
  if (!town) return {};
  return {
    title: { absolute: `Mobile Auto Detailing in ${town.name}, FL | Corsa` },
    description: `Interior and exterior car detailing at your home or workplace in ${town.name}, FL. Basic, Essential and Signature detailing packages from ${business.brand.name}.`,
    alternates: { canonical: `/service-areas/${town.slug}` },
  };
}

export default async function TownPage({ params }: PageProps<"/service-areas/[slug]">) {
  const { slug } = await params;
  const town = townBySlug(slug);
  if (!town) notFound();
  const cta = primaryCta();
  const nearby = towns.filter((c) => c.slug !== town.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Mobile auto detailing in ${town.name}, FL`,
      serviceType: "Mobile auto detailing",
      provider: { "@id": absoluteUrl("/#business"), "@type": "AutomotiveBusiness", name: business.brand.name },
      areaServed: { "@type": "Place", name: `${town.name}, FL` },
      url: absoluteUrl(`/service-areas/${town.slug}`),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Service areas", item: absoluteUrl("/service-areas") },
        { "@type": "ListItem", position: 3, name: town.name, item: absoluteUrl(`/service-areas/${town.slug}`) },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-generated content from configuration — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PageHero eyebrow={`Service area · ${town.county} County`} title={`Mobile auto detailing in ${town.name}, FL`} lede={town.intro} />

      <Section tone="chalk">
        <SectionHeading
          eyebrow={`Packages in ${town.name}`}
          title="Two packages. We come to you."
          lede={`Both packages are done by hand at your home or workplace in ${town.name}. See the services page for starting prices by vehicle size.`}
        />
        <div className="mt-12">
          <PackageCards showPrices={false} />
        </div>
      </Section>

      <Section tone="white">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHeading eyebrow="Coverage" title={`Serving ${town.name}`} />
            <dl className="mt-8 divide-y divide-line border-y border-line">
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <dt className="w-40 shrink-0 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Coverage</dt>
                <dd>
                  {town.coverage === "core"
                    ? "Core service area."
                    : "Travel confirmed for your exact address when we review your request."}
                </dd>
              </div>
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <dt className="w-40 shrink-0 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Good to know</dt>
                <dd>{town.blurb}</dd>
              </div>
              {town.zips.length > 0 && (
                <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                  <dt className="w-40 shrink-0 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">ZIP codes</dt>
                  <dd className="font-mono text-sm leading-relaxed">{town.zips.join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
          <div>
            <SectionHeading eyebrow="ZIP check" title="Can we reach you?" lede="Enter your ZIP for an instant answer. Final eligibility is confirmed when we review your request." />
            <div className="mt-6">
              <ZipChecker />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="chalk">
        <SectionHeading eyebrow="Nearby" title="Other areas we serve" />
        <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/service-areas/${c.slug}`}
                className="group flex items-center justify-between gap-4 bg-white px-5 py-4 font-medium hover:bg-chalk"
              >
                Mobile detailing in {c.name}
                <Arrow />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="dark">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h2 className="font-display text-3xl text-balance">Detailing in {town.name}, at your door.</h2>
          <ButtonLink href={cta.href} variant="apex" size="lg">
            {cta.label}
            <Arrow />
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
