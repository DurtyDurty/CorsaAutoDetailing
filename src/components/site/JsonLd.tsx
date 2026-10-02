import { business, absoluteUrl } from "@/config/business";

/**
 * LocalBusiness (AutomotiveBusiness) + Service + Offer structured data, limited
 * to facts we can stand behind. No street address, coordinates, opening hours
 * or ratings — this is a mobile business and those aren't verified.
 * Prices are published as starting prices (minPrice), matching the site, and
 * only on pages that show prices (`withOffers`), never on the home page.
 */
export function BusinessJsonLd({ withOffers = true }: { withOffers?: boolean }) {
  const id = absoluteUrl("/#business");
  const visitPrices = business.services.filter((s) => s.billing === "visit").map((s) => s.price);

  const areaServed = [
    { "@type": "City", name: "Jacksonville, FL" },
    { "@type": "AdministrativeArea", name: "Clay County, FL" },
    { "@type": "AdministrativeArea", name: "St. Johns County, FL" },
    ...business.serviceAreas.communities
      .filter((c) => c.name !== "Jacksonville")
      .map((c) => ({ "@type": "Place", name: `${c.name}, FL` })),
  ];

  const packageOffers = business.services.map((s) => ({
    "@type": "Offer",
    priceCurrency: "USD",
    price: s.price,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      name: "Starting price",
      minPrice: s.price,
      priceCurrency: "USD",
      ...(s.billing === "monthly" ? { unitText: "MONTH" } : {}),
    },
    itemOffered: {
      "@type": "Service",
      name: s.name,
      serviceType: "Mobile auto detailing",
      description: s.includes.join(", "),
      provider: { "@id": id },
      areaServed,
    },
  }));

  const addOnOffers = business.additionalServices.map((a) => ({
    "@type": "Offer",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: a.priceMin,
      maxPrice: a.priceMax,
      priceCurrency: "USD",
    },
    itemOffered: { "@type": "Service", name: a.name, provider: { "@id": id } },
  }));

  const data = {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    "@id": id,
    name: business.brand.name,
    slogan: business.brand.tagline.replace(/\.$/, ""),
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/logo-master.svg"),
    image: absoluteUrl("/icon-512.png"),
    description:
      "Mobile auto detailing in Clay County, St. Johns County and Jacksonville, Florida: interior and exterior car detailing at your home or workplace.",
    areaServed,
    ...(withOffers
      ? {
          priceRange: `$${Math.min(...visitPrices)}-$${Math.max(...visitPrices)}`,
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Detailing packages and additional services",
            itemListElement: [...packageOffers, ...addOnOffers],
          },
        }
      : {}),
    ...(business.contact.email ? { email: business.contact.email } : {}),
    ...(business.contact.phone ? { telephone: business.contact.phone } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // Static, server-generated content from configuration — no user input. "<" is escaped anyway,
      // so a value can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
