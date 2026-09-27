import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { MembershipInterestForm } from "@/components/forms/MembershipInterestForm";
import { storeKind } from "@/lib/leads/store";
import { UnavailableNotice } from "@/components/site/UnavailableNotice";

export const metadata: Metadata = {
  title: "Maintenance plans",
  description:
    "A proposed monthly or twice-monthly maintenance visit to keep your car consistently clean. Not available yet — register interest.",
  alternates: { canonical: "/maintenance-plans" },
};

export default function MaintenancePlansPage() {
  if (!business.membership.enabled) notFound();
  const unavailable = storeKind() === "unavailable";

  return (
    <>
      <PageHero
        eyebrow="Maintenance plans · in development"
        title="Keep it clean without thinking about it."
        lede="We're exploring a simple plan: a scheduled visit every month or twice a month so your car never gets far from clean. It isn't available yet, prices aren't set, and nothing here is for sale."
      />

      <Section tone="white">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHeading eyebrow="The idea" title="What a plan would look like." />
            <ul className="mt-6 space-y-4 text-ink-muted leading-relaxed">
              <li className="flex gap-3">
                <span aria-hidden="true" className="text-apex-deep">—</span>
                A recurring visit on a cadence you choose — monthly or twice-monthly — using the Exterior Wash &amp; Protect or Full Detail package.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="text-apex-deep">—</span>
                Vehicles that haven&rsquo;t been detailed recently may need an initial qualifying clean first so the plan can genuinely be maintenance.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="text-apex-deep">—</span>
                A predictable price. We&rsquo;re not promising discounts or unlimited visits — we&rsquo;d rather set terms we can keep.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="text-apex-deep">—</span>
                Weather, rescheduling and cancellation rules written down before anyone pays a cent.
              </li>
            </ul>
            <p className="mt-8 text-sm text-ink-muted border border-line rounded-sm px-4 py-3 bg-chalk">
              Registering interest doesn&rsquo;t enroll you in anything and nothing is charged. It just tells us how many people want this and what they&rsquo;d want from it.
            </p>
          </div>
          <div className="border border-line bg-chalk rounded-md p-6 sm:p-8">
            <h2 className="font-display text-2xl">Tell us you&rsquo;re interested</h2>
            <div className="mt-6">{unavailable ? <UnavailableNotice /> : <MembershipInterestForm />}</div>
          </div>
        </div>
      </Section>

      <Container className="pb-16 text-sm text-ink-muted">
        <p>
          Future studio services ({business.futureServices.join(", ")}) are ideas, not offerings. We&rsquo;ll only announce them if and when they&rsquo;re real.
        </p>
      </Container>
    </>
  );
}
