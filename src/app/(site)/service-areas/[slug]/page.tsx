import type { Metadata } from "next";
import { TownPageView, townMetadata, towns } from "@/components/site/TownPageView";

/** One SEO landing page per served community. URLs unchanged by the 2026-10-28 redesign (search and ads use them). */

export const dynamicParams = false;

export function generateStaticParams() {
  return towns.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/service-areas/[slug]">): Promise<Metadata> {
  return townMetadata((await params).slug, "en");
}

export default async function TownPage({ params }: PageProps<"/service-areas/[slug]">) {
  return <TownPageView slug={(await params).slug} lang="en" />;
}
