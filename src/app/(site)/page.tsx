import type { Metadata } from "next";
import Link from "next/link";
import { business, isPrelaunch, primaryCta } from "@/config/business";
import { photos } from "@/config/photos";
import { formatUsd, groupStartingPrice } from "@/lib/pricing";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { HeroSlideshow, type HeroSlide } from "@/components/site/HeroSlideshow";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { PackageCards } from "@/components/site/PackageCards";
import { CareJourney } from "@/components/site/CareJourney";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { Reviews } from "@/components/site/Reviews";
import { Faq } from "@/components/site/Faq";
import { BusinessJsonLd } from "@/components/site/JsonLd";
import { LaunchListForm } from "@/components/forms/LaunchListForm";
import { HOME_FAQ } from "@/content/faq";

export const metadata: Metadata = {
  title: { absolute: "Mobile Auto Detailing in Clay County & Jacksonville | Corsa" },
  description:
    "Mobile auto detailing in Clay County, St. Johns and Jacksonville, FL. Interior and exterior car detailing, done by hand at your home or workplace.",
  alternates: { canonical: "/" },
  // No openGraph override here: it would drop the site-wide share image (app/opengraph-image.png).
};

/** Hero slideshow order: the animated logo opens (owner's choice), then the strongest photo. */
const heroSlides: HeroSlide[] = [
  { type: "logo" },
  { type: "photo", photo: photos.stingerRear },
  { type: "photo", photo: photos.interiorBeforeAfter },
  { type: "photo", photo: photos.stingerFront },
  { type: "photo", photo: photos.stingerDriveway },
  { type: "photo", photo: photos.onSiteSetup },
];

export default function HomePage() {
  const cta = primaryCta();
  const { communities, region } = business.serviceAreas;
  const core = communities.filter((c) => c.coverage === "core");
  const confirm = communities.filter((c) => c.coverage === "confirm");
  const fromPrice = formatUsd(groupStartingPrice("popular"));
  const reviews = business.testimonials;
  const fiveStarGoogle = reviews.length > 0 && reviews.every((r) => r.rating === 5 && r.source === "Google");

  return (
    <>
      <BusinessJsonLd withOffers={false} />

      {/*
        Hero. Phones: a slideshow strip above the text, so the car isn't hidden behind it.
        Desktop: text on the left, slideshow on the right.
      */}
      <section className="overflow-hidden bg-asphalt text-chalk on-dark lg:grid lg:grid-cols-2">
        <div className="relative h-[38svh] min-h-64 sm:h-[46svh] lg:order-2 lg:h-auto lg:min-h-[44rem]">
          <HeroSlideshow slides={heroSlides} label="Photos of our work" />
        </div>

        <div className="relative px-5 pb-12 pt-4 sm:px-8 sm:pb-14 lg:flex lg:flex-col lg:justify-center lg:py-20 lg:pr-14 lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-apex">
            {business.brand.tagline.replace(/\.$/, "")}
          </p>
          {/* The keyword phrase is the H1 so search engines read "Mobile auto detailing in …" as the page topic. */}
          <h1 className="mt-3 lg:mt-4">
            <span className="block font-display text-[2.9rem] leading-[0.92] sm:text-7xl xl:text-[5.5rem] text-balance">
              Mobile auto detailing
            </span>
            <span className="mt-2 block text-lg font-semibold sm:mt-3 sm:text-xl text-chalk/90">in {region}</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-chalk/80 sm:mt-5">
            Interior and exterior car detailing at your home or workplace. You don&rsquo;t need to provide water or
            power. {isPrelaunch ? "Planned packages" : "Packages"} start at {fromPrice}.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <ButtonLink href={cta.href} variant="apex" size="lg">
              {cta.label}
              <Arrow />
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="outline-light">
              See packages &amp; prices
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-chalk/75">
            {fiveStarGoogle && (
              <li>
                <a href="#reviews" className="hover:text-chalk">
                  <span className="text-apex" aria-hidden="true">
                    ★★★★★{" "}
                  </span>
                  5-star reviews on Google
                </a>
              </li>
            )}
            <li>Nothing charged online</li>
            <li>Done by hand</li>
          </ul>
        </div>
      </section>

      <Reviews tone="white" />

      {/* Packages + pricing */}
      <Section tone="chalk" id="packages" className="scroll-mt-20">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <SectionHeading
            title="Detailing packages"
            lede="Every package covers the inside and the outside. Prices start with sedans and go up by vehicle size; the final price is confirmed when we see the car."
          />
          <Link
            href="/services#quote"
            className="group inline-flex shrink-0 items-center gap-2 font-semibold text-apex-deep"
          >
            Get an instant quote
            <Arrow />
          </Link>
        </div>
        <div className="mt-12">
          <PackageCards groups={["popular"]} />
        </div>
      </Section>

      <CareJourney />

      {/* Process */}
      <Section tone="white">
        <SectionHeading title="How booking works" />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </Section>

      {/* Service area */}
      <Section tone="chalk">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-12 items-start">
          <SectionHeading
            title="Where we work"
            lede="Our home base is Clay County. Jacksonville mobile detailing is available too; we confirm travel for your exact location when we review your request."
          />
          <div>
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {core.map((c) => (
                <li key={c.slug} className="border-b border-line">
                  <TownLink town={c} />
                </li>
              ))}
            </ul>
            {confirm.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Travel confirmed on review
                </h3>
                <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
                  {confirm.map((c) => (
                    <li key={c.slug} className="border-b border-line">
                      <TownLink town={c} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/service-areas" className="group mt-8 inline-flex items-center gap-2 font-semibold text-apex-deep">
              Check your ZIP
              <Arrow />
            </Link>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10">
          <SectionHeading title="Questions before you book" />
          <Faq items={HOME_FAQ} />
        </div>
      </Section>

      {/* Final CTA / launch list */}
      <section id="launch-list" className="bg-asphalt text-chalk on-dark scroll-mt-20">
        <Container className="py-16 sm:py-24">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <div>
              <h2 className="font-display text-5xl sm:text-6xl text-balance">
                {isPrelaunch ? "Be first in line when we open." : "Book a detail in about two minutes"}
              </h2>
              <p className="mt-6 text-lg text-chalk/75 leading-relaxed max-w-lg">
                {isPrelaunch
                  ? "Leave your name, email and ZIP. We'll let you know when scheduling opens in your area. Nothing else, no spam."
                  : "Pick a service and an open time on the calendar. We hold it for you and confirm by email."}
              </p>
            </div>
            <div className="rounded-lg bg-white text-ink p-6 sm:p-8">
              {isPrelaunch ? (
                <LaunchListForm />
              ) : (
                <div className="flex flex-col gap-4">
                  <ButtonLink href="/request" size="lg" variant="apex">
                    Book a detail
                    <Arrow />
                  </ButtonLink>
                  <p className="text-sm text-ink-muted">
                    Your time is held while we review your request; you&rsquo;ll get a confirmation email once it&rsquo;s confirmed. Nothing is charged online.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

/** A served community: links to its town page when it has one. */
function TownLink({ town }: { town: { slug: string; name: string; page: boolean } }) {
  const label = <span className="text-lg font-medium">{town.name}</span>;
  if (!town.page) return <span className="flex py-3.5">{label}</span>;
  return (
    <Link href={`/service-areas/${town.slug}`} className="group flex items-center justify-between gap-4 py-3.5 hover:text-apex-deep">
      {label}
      <Arrow />
    </Link>
  );
}
