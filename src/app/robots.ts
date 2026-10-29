import type { MetadataRoute } from "next";
import { business, absoluteUrl } from "@/config/business";

export default function robots(): MetadataRoute.Robots {
  if (business.brand.siteEnv === "staging") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/thanks", "/es/thanks", "/request", "/booking", "/quote", "/q/", "/invoice/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
