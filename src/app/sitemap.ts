import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";
import { localePath } from "@/i18n/dictionary";

export default function sitemap(): MetadataRoute.Sitemap {
  if (business.brand.siteEnv === "staging") return [];
  const routes = ["/", "/services", "/maintenance-plans", "/service-areas", "/about", "/contact", "/privacy", "/terms"].filter(
    (r) => r !== "/maintenance-plans" || business.membership.enabled,
  );
  const towns = business.serviceAreas.communities.filter((c) => c.page).map((c) => `/service-areas/${c.slug}`);
  // Pages with a Spanish version (/es...) list both, each pointing at the other (hreflang).
  const bilingual = new Set(["/", ...towns]);
  const now = new Date();
  const entry = (r: string, url: string) => ({
    url,
    lastModified: now,
    changeFrequency: (r === "/" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: r === "/" ? 1 : r === "/services" || r.startsWith("/service-areas") ? 0.8 : 0.5,
    ...(bilingual.has(r) && { alternates: { languages: { en: absoluteUrl(r), es: absoluteUrl(localePath("es", r)) } } }),
  });
  return [
    ...[...routes, ...towns].map((r) => entry(r, absoluteUrl(r))),
    ...[...bilingual].map((r) => entry(r, absoluteUrl(localePath("es", r)))),
  ];
}
