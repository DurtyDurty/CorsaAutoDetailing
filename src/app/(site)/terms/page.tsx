import type { Metadata } from "next";
import { business, isPrelaunch } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { bookingEnabled } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Service terms",
  description: `How quotes, scheduling and service work with ${business.brand.name}.`,
  alternates: { canonical: "/terms" },
};

/**
 * DRAFT. Only states what the business actually does today. Cancellation fees,
 * refund windows, guarantees and similar policies are intentionally absent
 * until the owner decides them (OWNER_DECISIONS.md).
 */
export default function TermsPage() {
  const deposits = bookingEnabled();
  return (
    <>
      <PageHero eyebrow="Service terms" title="How working with us works." lede="Plain-language draft. Last updated September 2026." />
      <Container className="py-12 sm:py-16 max-w-3xl prose-basic">
        {isPrelaunch && (
          <p className="border border-line bg-white rounded-sm px-4 py-3 text-sm">
            We are preparing to launch and are not yet performing services or confirming appointments. These terms describe how things will work once we open.
          </p>
        )}

        <h2>Requests and quotes</h2>
        <ul>
          <li>Submitting a request on this site is not a booking. Every request is reviewed by the owner.</li>
          <li>Prices shown online are {business.priceLabel[business.mode].toLowerCase()} for vehicles in average condition.</li>
          <li>{business.disclosures.inspection}</li>
          <li>{business.taxNotice}</li>
          <li>Minivans, oversized trucks, heavily soiled and unusual vehicles are quoted individually.</li>
          <li>No payment is collected until availability and final pricing are confirmed.</li>
        </ul>

        <h2>Scope and extra work</h2>
        <ul>
          <li>Each package includes exactly what is listed on the services page.</li>
          <li>{business.disclosures.pricing}</li>
          <li>Additional services (such as excessive pet-hair removal, extraction or headlight restoration) are priced as ranges on the services page and confirmed at inspection. Nothing extra is performed or charged without your approval.</li>
          <li>{business.disclosures.protection}</li>
        </ul>

        <h2>Scheduling</h2>
        <ul>
          {deposits ? (
            <li>Online bookings are confirmed when the deposit is paid; you&rsquo;ll receive a confirmation by email. Appointments arranged directly with us are confirmed when we agree on a time.</li>
          ) : (
            <li>Appointments are confirmed when we agree on a time with you.</li>
          )}
          <li>Times are in Eastern time and are arrival times.</li>
        </ul>

        {deposits ? (
          <>
            <h2>Deposits, cancellations and weather</h2>
            <ul>
              {business.booking.policy.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>Deposits are paid through Stripe&rsquo;s secure checkout. We never see or store your card details.</li>
            </ul>
          </>
        ) : (
          <>
            <h2>Weather</h2>
            <ul>
              <li>If weather prevents the service, we reschedule at no charge.</li>
            </ul>
          </>
        )}

        <h2>At your location</h2>
        <ul>
          <li>We ask about working space and access to water or power so we can plan. This information helps us prepare; it isn&rsquo;t a condition of service and doesn&rsquo;t change your price.</li>
          <li>Some HOAs and workplaces restrict vehicle washing on their property. Please check before we arrive.</li>
        </ul>

        <h2>Payment</h2>
        <p>
          {deposits
            ? "The only payment taken through this website is the booking deposit described above. The remaining balance is paid when the service is complete."
            : "No payment is taken through this website. You pay when the service is complete."}{" "}
          Accepted payment methods will be listed here before we open (owner decision pending).
        </p>

        <h2>Maintenance plans</h2>
        <p>
          Monthly Maintenance is arranged with you directly: we agree on your visits and how you&rsquo;ll pay. This website doesn&rsquo;t bill you automatically.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms:{" "}
          {business.contact.email ? <a href={`mailto:${business.contact.email}`}>{business.contact.email}</a> : "use the contact form"}.
        </p>
      </Container>
    </>
  );
}
