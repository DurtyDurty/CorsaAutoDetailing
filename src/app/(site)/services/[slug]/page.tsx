import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business, absoluteUrl, isPrelaunch, primaryCta } from "@/config/business";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Faq } from "@/components/site/Faq";
import { PricingDisclosures } from "@/components/site/Disclosures";
import { servicePage, servicePages } from "@/content/service-pages";

/** One page per service people search for (SEO, 2026-11-18). Content: src/content/service-pages.ts. */

export const dynamicParams = false;

export function generateStaticParams() {
  return servicePages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const page = servicePage((await params).slug);
  if (!page) return {};
  return {
    title: { absolute: page.metaTitle },
    description: page.description,
    alternates: { canonical: `/services/${page.slug}` },
  };
}

export default async function ServiceDetailPage({ params }: PageProps<"/services/[slug]">) {
  const page = servicePage((await params).slug);
  if (!page) notFound();
  const path = `/services/${page.slug}`;
  const book = isPrelaunch ? primaryCta().href : `/book?service=${page.bookService}`;
  const others = servicePages().filter((p) => p.slug !== page.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.name,
      serviceType: page.name,
      description: page.description,
      url: absoluteUrl(path),
      provider: { "@id": absoluteUrl("/#business"), "@type": "AutoWash", name: business.brand.name },
      areaServed: [
        { "@type": "AdministrativeArea", name: "Clay County, FL" },
        { "@type": "City", name: "Jacksonville, FL" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Services", item: absoluteUrl("/services") },
        { "@type": "ListItem", position: 3, name: page.name, item: absoluteUrl(path) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-generated content from configuration, no user input. "<" is escaped anyway.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PageHero eyebrow="Mobile detailing · Services" title={page.title} lede={page.lede} photo={page.photo}>
        <ButtonLink href={book} variant="apex" size="lg">
          {isPrelaunch ? primaryCta().label : "Book a detail"}
        </ButtonLink>
      </PageHero>

      {page.sections.map((s, i) => (
        <Section key={s.heading} tone={i % 2 === 0 ? "white" : "chalk"}>
          <SectionHeading title={s.heading} lede={s.body} />
          {s.items && (
            <ul className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2">
              {s.items.map((it) => (
                <li key={it.label} className="bg-white px-5 py-5">
                  <h3 className="font-semibold text-lg">{it.label}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink-muted">{it.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      <Section tone="chalk" className="!py-10">
        <PricingDisclosures />
      </Section>

      <Section tone="white">
        <SectionHeading title={`${page.name}: questions`} />
        <div className="mt-10 max-w-3xl">
          <Faq items={page.faq} />
        </div>
      </Section>

      <Section tone="chalk">
        <SectionHeading title="More services" />
        <ul className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/services/${p.slug}`} className="group flex min-h-14 items-center justify-between gap-4 bg-white px-5 py-4 font-medium hover:text-apex-deep">
                {p.name}
                <span aria-hidden="true" className="text-apex-deep transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/services" className="group flex min-h-14 items-center justify-between gap-4 bg-white px-5 py-4 font-medium hover:text-apex-deep">
              All packages and prices
              <span aria-hidden="true" className="text-apex-deep transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </li>
        </ul>
      </Section>

      <Section tone="dark">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-3xl text-balance">Mobile detailing in Clay County and Jacksonville, at your door.</h2>
          <ButtonLink href={book} variant="apex" size="lg">
            {isPrelaunch ? primaryCta().label : "Book a detail"}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
