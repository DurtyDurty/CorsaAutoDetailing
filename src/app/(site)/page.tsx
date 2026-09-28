import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { business, isPrelaunch, primaryCta } from "@/config/business";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/ui/Section";
import { PackageCards } from "@/components/site/PackageCards";
import { CareJourney } from "@/components/site/CareJourney";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { HeroVideo } from "@/components/site/HeroVideo";
import { Faq } from "@/components/site/Faq";
import { BusinessJsonLd } from "@/components/site/JsonLd";
import { LaunchListForm } from "@/components/forms/LaunchListForm";
import { HOME_FAQ } from "@/content/faq";

export const metadata: Metadata = {
  title: { absolute: `${business.brand.name} | Mobile auto detailing in Clay County & Jacksonville, FL` },
  description:
    "Interior and exterior car detailing at your home or workplace. Mobile auto detailing in Clay County and Jacksonville, FL: the Corsa Essential and Corsa Signature Detail packages.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${business.brand.name} | Driven by Detail`,
    description: "Mobile auto detailing in Clay County and Jacksonville, Florida. Interior and exterior car detailing at your home or workplace.",
    url: "/",
  },
};

export default function HomePage() {
  const cta = primaryCta();
  const core = business.serviceAreas.communities.filter((c) => c.coverage === "core");
  const confirm = business.serviceAreas.communities.filter((c) => c.coverage === "confirm");
  // Multi-sentence taglines break one sentence per line.
  const [taglineLead, ...taglineRest] = business.brand.tagline.split(/(?<=\.)\s+/);
  const ticker = [
    ...business.services.map((s) => s.name),
    "Interior & exterior",
    "At your home or workplace",
    ...core.map((c) => c.name),
    "Jacksonville",
  ];

  return (
    <>
      <BusinessJsonLd withOffers={false} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-asphalt text-chalk on-dark">
        <div className="relative min-h-[88svh] lg:min-h-[92svh] flex flex-col">
          <HeroVideo />
          {/* Scrims: darken for legibility, heavier at the bottom and left where the text sits. */}
          <div className="absolute inset-0 bg-asphalt/55 sm:bg-asphalt/35" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-gradient-to-t from-asphalt via-asphalt/45 to-asphalt/0"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 hidden sm:block bg-gradient-to-r from-asphalt/75 via-asphalt/15 to-transparent"
            aria-hidden="true"
          />

          <Container className="relative z-10 mt-auto pt-32 pb-10 sm:pb-14">
            <div className="max-w-3xl [text-shadow:0_2px_24px_rgb(12_13_16/0.6)]">
              <Eyebrow onDark>Mobile auto detailing · {business.serviceAreas.region}</Eyebrow>
              <h1 className="font-display italic font-extrabold text-[3.5rem] leading-[0.9] sm:text-8xl lg:text-[7rem] mt-6 text-balance">
                {taglineLead}
                {taglineRest.length > 0 && <span className="block">{taglineRest.join(" ")}</span>}
              </h1>
              <div className="mt-6 flex items-center gap-4" aria-hidden="true">
                <span className="kerb h-1.5 w-24" />
              </div>
              <p className="mt-6 text-lg sm:text-xl text-chalk/80 max-w-xl leading-relaxed">
                Interior and exterior car detailing, brought to your home or workplace. Mobile auto detailing in Clay
                County and Jacksonville, done by hand and finished with real protection.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <ButtonLink href={cta.href} variant="apex" size="lg">
                  {cta.label}
                  <Arrow />
                </ButtonLink>
                <ButtonLink href="/services" size="lg" variant="outline-light">
                  Explore services
                </ButtonLink>
              </div>
            </div>
          </Container>
        </div>

        <Container className="relative">
          {/* Telemetry strip */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 border-t border-line-dark">
            <div className="py-5 pr-4 border-b lg:border-b-0 border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">01 / We come to you</dt>
              <dd className="mt-1.5 font-display italic font-extrabold text-3xl leading-tight">Home or workplace</dd>
            </div>
            <div className="py-5 pl-4 lg:pr-4 border-b lg:border-b-0 border-l border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">02 / Where</dt>
              <dd className="mt-2 text-chalk text-sm leading-relaxed">
                {core.map((c) => c.name).join(", ")}
                {confirm.length > 0 && (
                  <span className="text-chalk/60"> · {confirm.map((c) => c.name).join(", ")} (travel confirmed)</span>
                )}
              </dd>
            </div>
            <div className="py-5 pr-4 lg:pl-4 lg:border-l border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">03 / Packages</dt>
              <dd className="mt-2 text-chalk text-sm leading-relaxed">
                {business.services.map((s) => (
                  <span key={s.id} className="block">
                    {s.name}
                  </span>
                ))}
              </dd>
            </div>
            <div className="py-5 pl-4 border-l border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">04 / Status</dt>
              <dd className="mt-2 flex items-center gap-2 text-chalk text-sm">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-apex opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-apex" />
                </span>
                {isPrelaunch ? "Preparing to launch" : "Taking requests"}
              </dd>
            </div>
          </dl>
        </Container>

        {/* Ticker */}
        <div className="relative border-y border-line-dark bg-asphalt-soft overflow-hidden" aria-hidden="true">
          <div className="ticker-track flex w-max">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center">
                {[...ticker, ...ticker].map((t, i) => (
                  <span
                    key={`${dup}-${i}`}
                    className="flex items-center gap-6 px-6 py-3.5 font-display italic font-bold text-lg uppercase tracking-wide text-chalk/60"
                  >
                    {t}
                    <span className="h-1.5 w-1.5 -skew-x-[20deg] bg-chalk/30" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="kerb h-[3px] opacity-80" aria-hidden="true" />
      </section>

      {/* Packages + pricing */}
      <Section tone="chalk" id="packages" className="scroll-mt-20">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <SectionHeading
            eyebrow="Detailing packages"
            title="Two packages. Built to perform."
            lede="Start with Signature for a full reset, then keep it sharp with Essential. Book either one, or see pricing and every detail on the services page."
          />
          <Link
            href="/services"
            className="group inline-flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-sm text-apex-deep shrink-0"
          >
            Pricing &amp; full details
            <Arrow />
          </Link>
        </div>
        <div className="mt-12">
          <PackageCards showPrices={false} />
        </div>
      </Section>

      <CareJourney />

      {/* Service area */}
      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-start">
          <SectionHeading
            eyebrow="Service area"
            title={`${business.serviceAreas.region}.`}
            lede="Our home base is Clay County. Jacksonville mobile detailing is available too; we confirm travel for your exact location when we review your request."
          />
          <div>
            <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Core coverage</h3>
            <ul className="mt-3 border-t-2 border-asphalt">
              {core.map((c, i) => (
                <li key={c.slug} className="flex items-baseline gap-4 border-b border-line py-3">
                  <span className="font-mono text-xs text-ink-muted" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <span className="font-display text-3xl sm:text-4xl">{c.name}</span>
                </li>
              ))}
            </ul>
            {confirm.length > 0 && (
              <div className="mt-8">
                <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Travel confirmed on review</h3>
                <p className="mt-2 font-display text-3xl">{confirm.map((c) => c.name).join(" · ")}</p>
                <p className="mt-2 text-sm text-ink-muted">We confirm travel for your exact location when we review your request.</p>
              </div>
            )}
            <Link
              href="/service-areas"
              className="group mt-8 inline-flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-sm text-apex-deep"
            >
              Check your ZIP
              <Arrow />
            </Link>
          </div>
        </div>
      </Section>

      {/* Gallery — only real, approved work */}
      {business.gallery.length > 0 && (
        <Section tone="white">
          <SectionHeading eyebrow="Recent work" title="Real vehicles, real results." />
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
            {business.gallery.map((g) => (
              <Image key={g.src} src={g.src} alt={g.alt} width={g.width} height={g.height} className="w-full h-auto rounded-sm" />
            ))}
          </div>
        </Section>
      )}

      {/* Process */}
      <Section tone="dark" className="relative overflow-hidden">
        <SectionHeading eyebrow="How it works" title="Three steps. No phone tag." onDark />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10">
          <SectionHeading eyebrow="Questions" title="Things people ask before they book." />
          <Faq items={HOME_FAQ} />
        </div>
      </Section>

      {/* Final CTA / launch list */}
      <section id="launch-list" className="relative overflow-hidden bg-asphalt text-chalk on-dark scroll-mt-20">
        <div className="grid-lines absolute inset-0" aria-hidden="true" />
        <div
          className="absolute -left-40 bottom-[-30%] h-[32rem] w-[32rem] rounded-full bg-chalk/[0.04] blur-[120px]"
          aria-hidden="true"
        />
        <Container className="relative py-16 sm:py-24">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <div>
              <Eyebrow onDark>{isPrelaunch ? "Launch list" : "Get started"}</Eyebrow>
              <h2 className="font-display italic font-extrabold text-6xl sm:text-7xl mt-5 text-balance">
                {isPrelaunch ? (
                  <>
                    Be first in line when we open.
                  </>
                ) : (
                  <>
                    Ready when you are.
                  </>
                )}
              </h2>
              <p className="mt-6 text-lg text-chalk/75 leading-relaxed max-w-lg">
                {isPrelaunch
                  ? "Leave your name, email and ZIP. We'll let you know when scheduling opens in your area. Nothing else, no spam."
                  : "Tell us about your vehicle and we'll reply with a quote and available times."}
              </p>
            </div>
            <div className="relative bg-white text-ink rounded-sm p-6 sm:p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <span className="absolute inset-x-0 top-0 h-1 bg-apex" aria-hidden="true" />
              {isPrelaunch ? (
                <LaunchListForm />
              ) : (
                <div className="flex flex-col gap-4">
                  <ButtonLink href="/request" size="lg" variant="apex">
                    Request an appointment
                    <Arrow />
                  </ButtonLink>
                  <p className="text-sm text-ink-muted">
                    Requests are reviewed before scheduling; a submitted request isn&rsquo;t a confirmed appointment.
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
