import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";

export default function sitemap(): MetadataRoute.Sitemap {
  if (business.brand.siteEnv === "staging") return [];
  const routes = ["/", "/services", "/maintenance-plans", "/service-areas", "/about", "/contact", "/privacy", "/terms"].filter(
    (r) => r !== "/maintenance-plans" || business.membership.enabled,
  );
  const now = new Date();
  return routes.map((r) => ({
    url: absoluteUrl(r),
    lastModified: now,
    changeFrequency: r === "/" ? "weekly" : "monthly",
    priority: r === "/" ? 1 : 0.7,
  }));
}
