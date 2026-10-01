import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business, isPrelaunch } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { getLeadStore } from "@/lib/leads/store";
import { billingSuffix, formatUsd } from "@/lib/pricing";
import { shortRef } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

const KINDS = {
  "launch-list": {
    title: "You're on the list.",
    body: isPrelaunch
      ? `We'll email you when scheduling opens in ${business.serviceAreas.region}. Until then, nothing else will arrive from us unless you opted into updates.`
      : "We'll be in touch shortly.",
    next: "In the meantime, you can look over the services and planned pricing.",
    cta: { label: "Explore services", href: "/services" },
  },
  request: {
    title: isPrelaunch ? "Request saved. We'll quote it when we open." : "Request received.",
    body: isPrelaunch
      ? "We're not confirming appointments yet. Your details are saved, and once we launch we'll reach out with a firm quote and available times."
      : "This is not a confirmed appointment yet. We'll review your vehicle and location details and reply with a firm quote and proposed times. Nothing is scheduled until you agree.",
    next: "Watch for a reply by your preferred contact method.",
    cta: { label: "Back to home", href: "/" },
  },
  membership: {
    title: "Thanks, interest noted.",
    body: "Maintenance plans aren't available yet and nothing has been charged or enrolled. When pricing and terms are set, we'll share them with you first.",
    next: isPrelaunch ? "Booking opens soon. We'll email you when it does." : "You're welcome to book a one-time service in the meantime.",
    cta: isPrelaunch ? { label: "Explore services", href: "/services" } : { label: "Request an appointment", href: "/request" },
  },
  contact: {
    title: "Message received.",
    body: "We read every message personally and will reply as soon as we can.",
    next: business.contact.responseHours ? `We typically reply during ${business.contact.responseHours}.` : "",
    cta: { label: "Back to home", href: "/" },
  },
} as const;

export default async function ThanksPage({ params, searchParams }: PageProps<"/thanks/[kind]">) {
  const { kind } = await params;
  const { ref } = await searchParams;
  if (!(kind in KINDS)) notFound();
  const copy = KINDS[kind as keyof typeof KINDS];

  // Only show success for a lead that actually exists in durable storage.
  const store = await getLeadStore();
  const lead = typeof ref === "string" && store ? await store.getLead(ref).catch(() => null) : null;

  if (!lead) {
    return (
      <Container className="py-20 max-w-2xl">
        <h1 className="font-display text-4xl">We couldn&rsquo;t find that submission.</h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          If you just sent a form and landed here, the request may not have saved. Please try again
          {business.contact.email ? (
            <>
              {" "}
              or email <a href={`mailto:${business.contact.email}`} className="underline underline-offset-4">{business.contact.email}</a>
            </>
          ) : null}
          .
        </p>
        <div className="mt-8">
          <ButtonLink href="/">Back to home</ButtonLink>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-20 max-w-2xl">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Reference {shortRef(lead.id)}</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-3 text-balance">{copy.title}</h1>
      <p className="mt-5 text-lg text-ink-muted leading-relaxed">{copy.body}</p>

      {lead.estimate && (
        <div className="mt-8 border border-line bg-white rounded-md p-5">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Your estimate</p>
          <p className="mt-2 flex items-baseline justify-between gap-4">
            <span>
              {lead.estimate.serviceName}
              {lead.estimate.vehicleCategoryLabel && ` · ${lead.estimate.vehicleCategoryLabel}`}
            </span>
            <span className="font-display text-2xl">
              {lead.estimate.total !== null ? `${formatUsd(lead.estimate.total)}${billingSuffix(lead.estimate.billing)}` : "Custom quote"}
            </span>
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            {lead.estimate.finalQuoteNotice} {lead.estimate.taxNotice}
          </p>
        </div>
      )}

      {copy.next && <p className="mt-6 text-ink-muted">{copy.next}</p>}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <ButtonLink href={copy.cta.href}>{copy.cta.label}</ButtonLink>
        <Link href="/contact" className="inline-flex items-center px-2 underline underline-offset-4">
          Need to change something? Contact us
        </Link>
      </div>
    </Container>
  );
}
