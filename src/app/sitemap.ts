import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";

export default function sitemap(): MetadataRoute.Sitemap {
  if (business.brand.siteEnv === "staging") return [];
  const routes = ["/", "/services", "/maintenance-plans", "/service-areas", "/about", "/contact", "/privacy", "/terms"].filter(
    (r) => r !== "/maintenance-plans" || business.membership.enabled,
  );
  const towns = business.serviceAreas.communities.filter((c) => c.page).map((c) => `/service-areas/${c.slug}`);
  const now = new Date();
  return [...routes, ...towns].map((r) => ({
    url: absoluteUrl(r),
    lastModified: now,
    changeFrequency: r === "/" ? "weekly" : "monthly",
    priority: r === "/" ? 1 : r === "/services" || r.startsWith("/service-areas") ? 0.8 : 0.5,
  }));
}
