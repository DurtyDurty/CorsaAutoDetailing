import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { business, absoluteUrl, isPrelaunch, primaryCta } from "@/config/business";
import { photos } from "@/config/photos";
import { dict, localePath, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "./PageHero";
import { PackageGrid } from "./PackageGrid";
import { ZipChecker } from "./ZipChecker";

/** One SEO landing page per served community (`page: true`), at /service-areas/<slug> and /es/service-areas/<slug>. */
export const towns = business.serviceAreas.communities.filter((c) => c.page);

export function townBySlug(slug: string) {
  return towns.find((c) => c.slug === slug);
}

export function townMetadata(slug: string, lang: Lang): Metadata {
  const town = townBySlug(slug);
  if (!town) return {};
  const path = `/service-areas/${town.slug}`;
  const alternates = {
    canonical: localePath(lang, path),
    languages: { en: path, es: localePath("es", path), "x-default": path },
  };
  return lang === "es"
    ? {
        title: { absolute: `Detallado móvil de autos en ${town.name}, FL | Corsa` },
        description: `Detallado interior y exterior en tu casa o trabajo en ${town.name}, FL. Paquetes Basic, Essential y Signature de ${business.brand.name}. Se habla español.`,
        alternates,
      }
    : {
        title: { absolute: `Mobile Auto Detailing in ${town.name}, FL | Corsa` },
        description: `Interior and exterior car detailing at your home or workplace in ${town.name}, FL. Basic, Essential and Signature detailing packages from ${business.brand.name}.`,
        alternates,
      };
}

export function TownPageView({ slug, lang }: { slug: string; lang: Lang }) {
  const town = townBySlug(slug);
  if (!town) notFound();
  const d = dict(lang).town;
  const es = lang === "es";
  const nearby = towns.filter((c) => c.slug !== town.slug);
  const path = `/service-areas/${town.slug}`;
  const book = isPrelaunch ? primaryCta().href : localePath(lang, "/book");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: d.title(town.name),
      serviceType: "Mobile auto detailing",
      provider: { "@id": absoluteUrl("/#business"), "@type": "AutoWash", name: business.brand.name },
      areaServed: { "@type": "Place", name: `${town.name}, FL` },
      url: absoluteUrl(localePath(lang, path)),
      inLanguage: lang,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: es ? "Inicio" : "Home", item: absoluteUrl(localePath(lang, "/")) },
        { "@type": "ListItem", position: 2, name: es ? "Zonas de servicio" : "Service areas", item: absoluteUrl(es ? "/es#service-area" : "/service-areas") },
        { "@type": "ListItem", position: 3, name: town.name, item: absoluteUrl(localePath(lang, path)) },
      ],
    },
  ];

  return (
    <div lang={lang}>
      <script
        type="application/ld+json"
        // Static, server-generated content from configuration, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PageHero eyebrow={d.eyebrow(town.county)} title={d.title(town.name)} lede={es ? town.es.intro : town.intro} photo={photos.stingerDriveway} />

      <Section tone="night">
        <SectionHeading title={d.packagesTitle(town.name)} lede={d.packagesLede(town.name)} onDark />
        <div className="mt-12">
          <PackageGrid lang={lang} />
        </div>
      </Section>

      <Section tone="night2">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title={d.serving(town.name)} onDark />
            <dl className="mt-8 divide-y divide-white/10 border-y border-white/10">
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-chalk/65">{d.coverage}</dt>
                <dd>{town.coverage === "core" ? d.coreCoverage : d.confirmCoverage}</dd>
              </div>
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-chalk/65">{d.goodToKnow}</dt>
                <dd>{es ? town.es.blurb : town.blurb}</dd>
              </div>
              {town.zips.length > 0 && (
                <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                  <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-chalk/65">{d.zips}</dt>
                  <dd className="text-sm leading-relaxed">{town.zips.join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
          {!es && (
            <div>
              <SectionHeading title="Can we reach you?" lede="Enter your ZIP for an instant answer. Final eligibility is confirmed when we review your request." onDark />
              <div className="mt-6 rounded-lg bg-chalk p-5 text-ink">
                <ZipChecker />
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section tone="night">
        <SectionHeading title={d.others} onDark />
        <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((c) => (
            <li key={c.slug}>
              <Link href={localePath(lang, `/service-areas/${c.slug}`)} className="group flex min-h-14 items-center justify-between gap-4 bg-night-2 px-5 py-4 font-medium hover:bg-night-3">
                {dict(lang).area.townLink(c.name)}
                <span aria-hidden="true" className="text-apex transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <section className="carbon text-chalk on-dark">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <h2 className="font-display text-3xl text-balance">{d.cta(town.name)}</h2>
          <Link href={book} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-apex-deep px-7 font-semibold text-white hover:bg-[#a51824]">
            {dict(lang).nav.book} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
