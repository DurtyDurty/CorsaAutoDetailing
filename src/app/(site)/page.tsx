import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { business, isPrelaunch, primaryCta } from "@/config/business";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/ui/Section";
import { PricingTable } from "@/components/site/PricingTable";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { HeroVideo } from "@/components/site/HeroVideo";
import { Faq } from "@/components/site/Faq";
import { OrganizationJsonLd } from "@/components/site/JsonLd";
import { LaunchListForm } from "@/components/forms/LaunchListForm";
import { HOME_FAQ } from "@/content/faq";

export const metadata: Metadata = {
  title: { absolute: `${business.brand.name} — Mobile detailing in Clay County, FL` },
  description:
    "Hand washing and interior maintenance at your driveway or workplace in Middleburg, Fleming Island, Green Cove Springs and Orange Park. Join the launch list.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${business.brand.name} — Thoughtful car care, right at your driveway`,
    description: "Mobile exterior washing and interior maintenance for daily drivers in Clay County, Florida.",
    url: "/",
  },
};

export default function HomePage() {
  const cta = primaryCta();
  const core = business.serviceAreas.communities.filter((c) => c.coverage === "core");
  const confirm = business.serviceAreas.communities.filter((c) => c.coverage === "confirm");
  const startingAt = Math.min(...business.services.flatMap((s) => Object.values(s.prices)));
  // "Thoughtful car care. Right at your driveway." → one sentence per line.
  const [taglineLead, ...taglineRest] = business.brand.tagline.split(/(?<=\.)\s+/);
  const ticker = [
    ...business.services.map((s) => s.name),
    "Done by hand",
    "At your driveway or workplace",
    ...core.map((c) => c.name),
  ];

  return (
    <>
      <OrganizationJsonLd />

      {/* Hero */}
      <section className="relative overflow-hidden bg-asphalt text-chalk on-dark">
        <div className="relative min-h-[88svh] lg:min-h-[92svh] flex flex-col">
          <HeroVideo />
          {/* Scrims: darken for legibility, heavier at the bottom and left where the text sits. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-asphalt via-asphalt/45 to-asphalt/0"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 hidden sm:block bg-gradient-to-r from-asphalt/75 via-asphalt/15 to-transparent"
            aria-hidden="true"
          />

          <Container className="relative z-10 mt-auto pt-32 pb-10 sm:pb-14">
            <div className="max-w-3xl">
              <Eyebrow onDark>Mobile auto detailing · {business.serviceAreas.region}</Eyebrow>
              <h1 className="font-display italic font-extrabold text-[3.5rem] leading-[0.9] sm:text-8xl lg:text-[7rem] mt-6 text-balance">
                {taglineLead}
                {taglineRest.length > 0 && <span className="block">{taglineRest.join(" ")}</span>}
              </h1>
              <div className="mt-6 flex items-center gap-4" aria-hidden="true">
                <span className="kerb h-1.5 w-24" />
              </div>
              <p className="mt-6 text-lg sm:text-xl text-chalk/80 max-w-xl leading-relaxed">
                Mobile exterior washing and interior maintenance for daily-driven cars and SUVs — done by hand, at your
                home or workplace, without the wait at a car wash.
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
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">01 / Starting at</dt>
              <dd className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display italic font-extrabold text-5xl">${startingAt}</span>
                <span className="text-xs text-chalk/60">{business.priceLabel[business.mode].toLowerCase()}</span>
              </dd>
            </div>
            <div className="py-5 pl-4 lg:pr-4 border-b lg:border-b-0 border-l border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">02 / Where</dt>
              <dd className="mt-2 text-chalk text-sm leading-relaxed">
                {core.map((c) => c.name).join(", ")}
                {confirm.length > 0 && (
                  <span className="text-chalk/60"> · {confirm.map((c) => c.name).join(", ")} (selected)</span>
                )}
              </dd>
            </div>
            <div className="py-5 pr-4 lg:pl-4 lg:border-l border-line-dark">
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/50">03 / Owner</dt>
              <dd className="mt-2 text-chalk text-sm leading-relaxed">
                {business.owner.name}
                {business.owner.veteranOwned && <span className="block text-chalk/60">U.S. Navy Chief, retired</span>}
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

      {/* Services + pricing */}
      <Section tone="chalk">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <SectionHeading
            eyebrow="Services"
            title="Two straightforward packages for cars that are driven every day."
            lede="No upsell ladder. Pick the one that matches how you use your car; we'll confirm the quote after a quick review."
          />
          <Link
            href="/services"
            className="group inline-flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-sm text-apex-deep shrink-0"
          >
            What&rsquo;s included and what isn&rsquo;t
            <Arrow />
          </Link>
        </div>
        <div className="mt-12">
          <PricingTable />
        </div>
      </Section>

      {/* Process */}
      <Section tone="dark" className="relative overflow-hidden">
        <SectionHeading eyebrow="How it works" title="Three steps. No phone tag." onDark />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </Section>

      {/* Service area */}
      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-start">
          <SectionHeading
            eyebrow="Service area"
            title={`Starting in ${business.serviceAreas.region}.`}
            lede="We're keeping the first service area small on purpose so every visit gets the time it deserves."
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
                <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Selected locations</h3>
                <p className="mt-2 font-display text-2xl text-ink-muted">{confirm.map((c) => c.name).join(" · ")}</p>
                <p className="mt-2 text-sm text-ink-muted">Travel eligibility confirmed when we review your request.</p>
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

      {/* Owner */}
      <Section tone="dark" className="relative overflow-hidden">
        <div className="grid-lines absolute inset-0" aria-hidden="true" />
        <div className="relative grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
          <div>
            <Eyebrow onDark>From the owner</Eyebrow>
            <h2 className="font-display italic font-extrabold text-5xl sm:text-6xl mt-5 text-balance">
              Twenty years of taking care of people and equipment. Now, your car.
            </h2>
          </div>
          <div className="border-l-2 border-apex/70 pl-6 sm:pl-8 space-y-5 text-lg text-chalk/80 leading-relaxed">
            {business.owner.bio.slice(0, 2).map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="font-mono text-sm uppercase tracking-[0.14em] text-apex">— {business.owner.name}</p>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-sm text-chalk hover:text-apex"
            >
              More about Corsa
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

      {/* Maintenance plan interest */}
      {business.membership.enabled && (
        <Section tone="chalk">
          <div className="relative overflow-hidden border-2 border-asphalt bg-white p-8 sm:p-12">
            <div className="kerb-slant absolute right-0 top-0 h-full w-3 sm:w-4" aria-hidden="true" />
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center pr-4">
              <SectionHeading
                eyebrow="Coming later"
                title="A maintenance plan for people who'd rather never think about it."
                lede="We're exploring monthly or twice-monthly visits to keep your car consistently clean. Pricing isn't set and nothing is for sale yet — tell us if you'd want it."
              />
              <div className="lg:justify-self-end">
                <ButtonLink href="/maintenance-plans" size="lg">
                  Tell us you&rsquo;re interested
                  <Arrow />
                </ButtonLink>
              </div>
            </div>
          </div>
        </Section>
      )}

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
