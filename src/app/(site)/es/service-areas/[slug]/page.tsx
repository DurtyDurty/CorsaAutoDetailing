import type { Metadata } from "next";
import { TownPageView, townMetadata, towns } from "@/components/site/TownPageView";

/** Spanish versions of the town pages, at /es/service-areas/<slug>. */

export const dynamicParams = false;

export function generateStaticParams() {
  return towns.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/service-areas/[slug]">): Promise<Metadata> {
  return townMetadata((await params).slug, "es");
}

export default async function PuebloPage({ params }: PageProps<"/es/service-areas/[slug]">) {
  return <TownPageView slug={(await params).slug} lang="es" />;
}
