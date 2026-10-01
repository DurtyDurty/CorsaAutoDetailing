import type { Metadata } from "next";
import { business } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${business.brand.name} collects, uses and protects the information you share through this website.`,
  alternates: { canonical: "/privacy" },
};

/**
 * DRAFT. Describes what the site actually does today. Items marked
 * "Owner decision pending" are tracked in OWNER_DECISIONS.md and must be
 * resolved before public launch (see LAUNCH_CHECKLIST.md).
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Privacy" title="What we collect, and why." lede="Plain-language draft. Last updated October 2026." />
      <Container className="py-12 sm:py-16 max-w-3xl prose-basic">
        <h2>Who we are</h2>
        <p>
          {business.brand.name} is a mobile auto detailing business owned by {business.owner.name}, serving {business.serviceAreas.region}.
          {business.contact.email ? (
            <>
              {" "}
              Privacy questions: <a href={`mailto:${business.contact.email}`}>{business.contact.email}</a>.
            </>
          ) : (
            <> Privacy questions can be sent through the contact form.</>
          )}
        </p>

        <h2>What we collect</h2>
        <p>Only what you type into our forms:</p>
        <ul>
          <li>
            <strong>Launch list:</strong> first name, email, ZIP code, and optionally vehicle type, service interest, phone and contact preference.
          </li>
          <li>
            <strong>Quote requests:</strong> the above plus vehicle year/make/model, condition notes, city or neighborhood, location type (home or work), preferred time windows or dates, and any notes you add. We do not ask for your street address until we schedule a visit.
          </li>
          <li>
            <strong>Vehicle photos</strong> (only if the upload option is shown): stored privately, re-encoded to strip location metadata, and used solely to prepare your quote.
          </li>
          <li>
            <strong>Maintenance-plan interest and contact messages:</strong> name, email, ZIP and your message.
          </li>
          <li>
            <strong>Technical details:</strong> the page you first arrived on and when, the referring site&rsquo;s domain, campaign tags (utm_source, utm_medium, utm_campaign, utm_term, utm_content) if present, and, if you came from one of our Google ads, the ad-click identifier Google adds to the link (gclid, gbraid or wbraid). Your browser keeps these in its own storage for up to 90 days so a later request can be credited to the ad; they identify an ad click, not you. We do not store your IP address; a short-lived hashed value is used only to limit repeated submissions.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To review and respond to your request, prepare quotes, and (once you agree) schedule service.</li>
          <li>To tell you when we open in your area if you joined the launch list.</li>
          <li>To send occasional marketing email <em>only if you ticked the separate marketing box</em>. You can unsubscribe at any time. We do not send SMS marketing.</li>
          <li>We record which version of our consent wording you saw and when.</li>
        </ul>

        <h2>Who sees it</h2>
        <p>
          The owner, through a password-protected dashboard. Your information is stored with our hosting and database provider and, when we email you, passed to our email delivery provider. We do not sell or rent your information, and we do not give your name or contact details to advertisers.
        </p>
        <p>
          If you reached us by clicking one of our Google ads, we tell Google Ads when that click led to a request, a booking or a payment, so we can see which ads work. We send only the ad-click identifier, the date and the amount. We never send your name, email, phone number or address.
        </p>

        <h2>Analytics</h2>
        <p>
          {business.analytics.provider === "none"
            ? "This site currently runs no analytics."
            : "We use privacy-respecting, aggregate analytics that record events such as “form started” or “service viewed.” Analytics never receives your name, email, phone, address, notes or photos."}{" "}
          We do not install advertising pixels or Google&rsquo;s advertising tag.
        </p>

        <h2>Retention</h2>
        <p>
          We keep inquiries for as long as needed to respond and serve you. A fixed retention period has not been set yet
          (owner decision pending); when it is, this section will state it. You can ask us to delete your information at any time and we will remove the record and any photos.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Ask what we hold about you, ask us to correct it, or ask us to delete it.</li>
          <li>Unsubscribe from marketing email using the link in any message, or by contacting us.</li>
        </ul>

        <h2>Security</h2>
        <p>
          Forms are submitted over HTTPS. Lead data is stored in a database that anonymous visitors cannot read; the dashboard requires the owner to sign in. No method is perfect, and we&rsquo;ll be honest with you if something goes wrong.
        </p>

        <h2>Changes</h2>
        <p>We&rsquo;ll update this page when our practices change and note the date at the top.</p>
      </Container>
    </>
  );
}
