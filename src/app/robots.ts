import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";

export default function robots(): MetadataRoute.Robots {
  if (business.brand.siteEnv === "staging") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/thanks", "/request", "/booking", "/quote"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
