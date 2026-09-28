import type { Metadata } from "next";
import { business } from "@/config/business";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { ContactLink } from "@/components/site/ContactLink";
import { formatPhone } from "@/lib/utils";
import { storeKind } from "@/lib/leads/store";
import { UnavailableNotice } from "@/components/site/UnavailableNotice";

export const metadata: Metadata = {
  title: "Contact",
  description: `Questions about mobile detailing in Clay County or Jacksonville? Contact ${business.brand.name}. Every message is read and answered personally.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const { contact } = business;
  const hasDirect = contact.email || contact.phone;
  const unavailable = storeKind() === "unavailable";

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Ask us anything."
        lede="Every message goes straight to the owner. Requests are reviewed before anything is scheduled. Sending a message doesn't create an appointment."
      />
      <Section tone="white">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12">
          <div>
            <SectionHeading eyebrow="Reach us" title="Direct lines." />
            {hasDirect ? (
              <ul className="mt-6 space-y-3 text-lg">
                {contact.email && (
                  <li>
                    <ContactLink method="email" href={`mailto:${contact.email}`} className="underline underline-offset-4">
                      {contact.email}
                    </ContactLink>
                  </li>
                )}
                {contact.phone && (
                  <li>
                    <ContactLink
                      method="phone"
                      href={`tel:+1${contact.phone.replace(/\D/g, "")}`}
                      className="underline underline-offset-4"
                    >
                      {formatPhone(contact.phone.replace(/\D/g, ""))}
                    </ContactLink>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-6 text-ink-muted">The form is the best way to reach us right now. We&rsquo;ll reply by email.</p>
            )}
            {contact.responseHours && <p className="mt-4 text-sm text-ink-muted">We reply during {contact.responseHours}.</p>}
            <p className="mt-8 text-sm text-ink-muted">
              Looking for a quote? The{" "}
              <a href="/request" className="underline underline-offset-4">
                request form
              </a>{" "}
              collects the vehicle details we need.
            </p>
          </div>
          <div className="border border-line bg-chalk rounded-md p-6 sm:p-8">
            {unavailable ? <UnavailableNotice /> : <ContactForm />}
          </div>
        </div>
      </Section>
    </>
  );
}
