import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { languageAlternates } from "@/i18n/routes";
import { groupStartingPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  // Names Jacksonville too: far more people search there than in the Clay County towns (SEO, 2026-11-18).
  title: { absolute: "Mobile Auto Detailing in Clay County & Jacksonville, FL | Corsa" },
  description: `Mobile auto detailing at your home or work in Middleburg, Fleming Island, Green Cove Springs, Orange Park and Jacksonville. Our trailer brings its own water and power. From $${groupStartingPrice("popular")}.`,
  alternates: languageAlternates("/"),
  // No openGraph override here: it would drop the site-wide share image (app/opengraph-image.png).
};

export default function Home() {
  return <HomePage lang="en" />;
}
