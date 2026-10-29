import { business, absoluteUrl, shownReviews } from "@/config/business";
import type { Lang } from "@/i18n/dictionary";

/**
 * LocalBusiness (AutoWash, a kind of AutomotiveBusiness) + Service + Offer structured data, limited to facts
 * we can stand behind: no street address or coordinates (it's a mobile business). Prices are published as
 * starting prices (minPrice), matching the site, and only on pages that show prices (`withOffers`).
 * AggregateRating appears only once the reviews section is shown (3+ real Google reviews).
 */
export function BusinessJsonLd({ withOffers = true, lang = "en" }: { withOffers?: boolean; lang?: Lang }) {
  const id = absoluteUrl("/#business");
  const packagePrices = business.services.filter((s) => !s.plan).map((s) => s.price);
  const reviews = shownReviews();

  const areaServed = [
    { "@type": "AdministrativeArea", name: "Clay County, FL" },
    { "@type": "AdministrativeArea", name: "St. Johns County, FL" },
    ...business.serviceAreas.communities.map((c) => ({ "@type": c.name === "Jacksonville" ? "City" : "Place", name: `${c.name}, FL` })),
  ];

  const packageOffers = business.services.map((s) => ({
    "@type": "Offer",
    priceCurrency: "USD",
    price: s.price,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      name: s.plan ? "Price per visit" : "Starting price",
      minPrice: s.price,
      priceCurrency: "USD",
    },
    itemOffered: {
      "@type": "Service",
      name: s.name,
      serviceType: "Mobile auto detailing",
      description: (lang === "es" ? s.es.includes : s.includes).join(", "),
      provider: { "@id": id },
      areaServed,
    },
  }));

  const addOnOffers = business.additionalServices.map((a) => ({
    "@type": "Offer",
    priceCurrency: "USD",
    priceSpecification: { "@type": "PriceSpecification", minPrice: a.priceMin, maxPrice: a.priceMax, priceCurrency: "USD" },
    itemOffered: { "@type": "Service", name: a.name, provider: { "@id": id } },
  }));

  const { start, end } = business.scheduling.workHours;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const data = {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": id,
    name: business.brand.name,
    slogan: business.brand.tagline.replace(/\.$/, ""),
    url: absoluteUrl(lang === "es" ? "/es" : "/"),
    logo: absoluteUrl("/brand/logo-master.svg"),
    image: absoluteUrl("/icon-512.png"),
    description:
      lang === "es"
        ? "Detallado móvil de autos con base en el condado de Clay, Florida: interior y exterior en tu casa o trabajo, con un tráiler que lleva su propia agua y electricidad."
        : "Mobile auto detailing based in Clay County, Florida: interior and exterior detailing at your home or workplace, from a trailer that carries its own water and power.",
    knowsLanguage: ["en", "es"],
    areaServed,
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: business.scheduling.workDays.map((d) => days[d]), opens: start, closes: end },
    ],
    ...(withOffers
      ? {
          priceRange: `$${Math.min(...packagePrices)}-$${Math.max(...packagePrices)}`,
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Detailing packages, Corsa Club and additional services",
            itemListElement: [...packageOffers, ...addOnOffers],
          },
        }
      : {}),
    ...(reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
            reviewCount: reviews.length,
            bestRating: 5,
          },
        }
      : {}),
    ...(business.contact.email ? { email: business.contact.email } : {}),
    ...(business.contact.phone ? { telephone: `+1-${business.contact.phone}` } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // Static, server-generated content from configuration, no user input. "<" is escaped anyway,
      // so a value can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
