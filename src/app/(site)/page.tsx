import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { business, isPrelaunch, primaryCta } from "@/config/business";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/ui/Section";
import { PricingTable } from "@/components/site/PricingTable";
import { ProcessSteps } from "@/components/site/ProcessSteps";
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

  return (
    <>
      <OrganizationJsonLd />

      {/* Hero */}
      <section className="bg-charcoal text-ivory on-dark">
        <Container className="py-20 sm:py-28 lg:py-32">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-end">
            <div>
              <Eyebrow className="text-champagne">Mobile auto detailing · {business.serviceAreas.region}</Eyebrow>
              <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl mt-5 text-balance">
                {business.brand.tagline}
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-ivory/80 max-w-xl leading-relaxed">
                Mobile exterior washing and interior maintenance for daily-driven cars and SUVs — done by hand, at your
                home or workplace, without the wait at a car wash.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <ButtonLink href={cta.href} variant="champagne" size="lg">
                  {cta.label}
                </ButtonLink>
                <ButtonLink
                  href="/services"
                  size="lg"
                  className="border-ivory/40 text-ivory bg-transparent hover:bg-ivory hover:text-charcoal"
                >
                  Explore services
                </ButtonLink>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line-dark pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0 text-sm">
              <div>
                <dt className="text-ivory/60">Where</dt>
                <dd className="mt-1 text-ivory">
                  {core.map((c) => c.name).join(", ")}
                  {confirm.length > 0 && (
                    <span className="text-ivory/70"> · {confirm.map((c) => c.name).join(", ")} (selected)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ivory/60">Starting at</dt>
                <dd className="mt-1 text-ivory">
                  ${Math.min(...business.services.flatMap((s) => Object.values(s.prices)))}{" "}
                  <span className="text-ivory/70">· {business.priceLabel[business.mode].toLowerCase()}</span>
                </dd>
              </div>
              <div>
                <dt className="text-ivory/60">Owner</dt>
                <dd className="mt-1 text-ivory">
                  {business.owner.name}
                  {business.owner.veteranOwned && <span className="text-ivory/70"> · U.S. Navy Chief, retired</span>}
                </dd>
              </div>
              <div>
                <dt className="text-ivory/60">Status</dt>
                <dd className="mt-1 text-ivory">{isPrelaunch ? "Preparing to launch" : "Taking requests"}</dd>
              </div>
            </dl>
          </div>
        </Container>
      </section>

      {/* Services + pricing */}
      <Section tone="ivory">
        <SectionHeading
          eyebrow="Services"
          title="Two straightforward packages for cars that are driven every day."
          lede="No upsell ladder. Pick the one that matches how you use your car; we'll confirm the quote after a quick review."
        />
        <div className="mt-12">
          <PricingTable />
        </div>
        <div className="mt-8">
          <Link href="/services" className="underline underline-offset-4 font-medium">
            See what&rsquo;s included and what isn&rsquo;t
          </Link>
        </div>
      </Section>

      {/* Process */}
      <Section tone="white">
        <SectionHeading eyebrow="How it works" title="Three steps. No phone tag." />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </Section>

      {/* Service area */}
      <Section tone="ivory">
        <div className="grid lg:grid-cols-2 gap-12">
          <SectionHeading
            eyebrow="Service area"
            title={`Starting in ${business.serviceAreas.region}.`}
            lede="We're keeping the first service area small on purpose so every visit gets the time it deserves."
          />
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-champagne-deep">Core coverage</h3>
              <ul className="mt-3 space-y-2">
                {core.map((c) => (
                  <li key={c.slug} className="text-lg">
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-champagne-deep">Selected locations</h3>
              <ul className="mt-3 space-y-2">
                {confirm.map((c) => (
                  <li key={c.slug} className="text-lg">
                    {c.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-muted">Travel eligibility confirmed when we review your request.</p>
            </div>
            <div className="sm:col-span-2">
              <Link href="/service-areas" className="underline underline-offset-4 font-medium">
                Service area details
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Owner */}
      <Section tone="dark">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 items-start">
          <div>
            <Eyebrow className="text-champagne">From the owner</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl mt-3 text-balance">
              Twenty years of taking care of people and equipment. Now, your car.
            </h2>
          </div>
          <div className="space-y-5 text-lg text-ivory/85 leading-relaxed">
            {business.owner.bio.slice(0, 2).map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="text-champagne">— {business.owner.name}</p>
            <Link href="/about" className="inline-block underline underline-offset-4 text-ivory">
              More about Corsa
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
        <Section tone="white">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <SectionHeading
              eyebrow="Coming later"
              title="A maintenance plan for people who'd rather never think about it."
              lede="We're exploring monthly or twice-monthly visits to keep your car consistently clean. Pricing isn't set and nothing is for sale yet — tell us if you'd want it."
            />
            <div className="lg:justify-self-end">
              <ButtonLink href="/maintenance-plans" variant="secondary" size="lg">
                Tell us you&rsquo;re interested
              </ButtonLink>
            </div>
          </div>
        </Section>
      )}

      {/* FAQ */}
      <Section tone="ivory">
        <SectionHeading eyebrow="Questions" title="Things people ask before they book." />
        <div className="mt-10 max-w-3xl">
          <Faq items={HOME_FAQ} />
        </div>
      </Section>

      {/* Final CTA / launch list */}
      <Section tone="white" id="launch-list" className="scroll-mt-20">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12">
          <SectionHeading
            eyebrow={isPrelaunch ? "Launch list" : "Get started"}
            title={isPrelaunch ? "Be first in line when we open." : "Ready when you are."}
            lede={
              isPrelaunch
                ? "Leave your name, email and ZIP. We'll let you know when scheduling opens in your area. Nothing else, no spam."
                : "Tell us about your vehicle and we'll reply with a quote and available times."
            }
          />
          <div className="border border-line bg-ivory rounded-md p-6 sm:p-8">
            {isPrelaunch ? (
              <LaunchListForm />
            ) : (
              <div className="flex flex-col gap-4">
                <ButtonLink href="/request" size="lg">
                  Request an appointment
                </ButtonLink>
                <p className="text-sm text-ink-muted">Requests are reviewed before scheduling; a submitted request isn&rsquo;t a confirmed appointment.</p>
              </div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
