import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { languageAlternates } from "@/i18n/routes";

export const metadata: Metadata = {
  title: { absolute: "Mobile Auto Detailing in Clay County, FL | Corsa" },
  description:
    "Mobile auto detailing in Green Cove Springs, Fleming Island, Middleburg and Orange Park. A self-contained trailer with its own water and power. Packages from $90. Se habla español.",
  alternates: languageAlternates("/"),
  // No openGraph override here: it would drop the site-wide share image (app/opengraph-image.png).
};

export default function Home() {
  return <HomePage lang="en" />;
}
