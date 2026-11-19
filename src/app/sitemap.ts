import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";
import { localePath } from "@/i18n/dictionary";
import { servicePages } from "@/content/service-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  if (business.brand.siteEnv === "staging") return [];
  const routes = ["/", "/book", "/services", "/maintenance-plans", "/service-areas", "/about", "/contact", "/privacy", "/terms"].filter(
    (r) => r !== "/maintenance-plans" || business.membership.enabled,
  );
  const services = servicePages().map((p) => `/services/${p.slug}`);
  const towns = business.serviceAreas.communities.filter((c) => c.page).map((c) => `/service-areas/${c.slug}`);
  // Pages with a Spanish version (/es...) list both, each pointing at the other (hreflang).
  const bilingual = new Set(["/", "/book", ...towns]);
  // No lastModified: it was the build time on every page, so it changed on every deploy and told Google nothing.
  const entry = (r: string, url: string) => ({
    url,
    changeFrequency: (r === "/" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: r === "/" ? 1 : r === "/book" || r.startsWith("/services") || r.startsWith("/service-areas") ? 0.8 : 0.5,
    ...(bilingual.has(r) && { alternates: { languages: { en: absoluteUrl(r), es: absoluteUrl(localePath("es", r)) } } }),
  });
  return [
    ...[...routes, ...services, ...towns].map((r) => entry(r, absoluteUrl(r))),
    ...[...bilingual].map((r) => entry(r, absoluteUrl(localePath("es", r)))),
  ];
}
