import { business, absoluteUrl } from "@/config/business";

/**
 * Structured data limited to facts we can stand behind. No address, no
 * coordinates, no opening hours, no ratings — those are not verified yet.
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: business.brand.name,
    url: absoluteUrl("/"),
    description:
      "Mobile exterior washing and interior maintenance for daily drivers in Clay County, Florida.",
    founder: { "@type": "Person", name: business.owner.name },
    areaServed: business.serviceAreas.communities.map((c) => ({
      "@type": "Place",
      name: `${c.name}, FL`,
    })),
    ...(business.contact.email ? { email: business.contact.email } : {}),
    ...(business.contact.phone ? { telephone: business.contact.phone } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // Static, server-generated content from configuration — no user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
