import type { Metadata } from "next";
import { BookPageView } from "@/components/home/BookPageView";
import { languageAlternates } from "@/i18n/routes";

export const metadata: Metadata = {
  title: "Book a mobile detail",
  description:
    "Book mobile auto detailing in Clay County, FL. Packages from $90, done at your home or work from a self-contained trailer. Nothing is charged online.",
  alternates: languageAlternates("/book"),
  // The ads landing page; the home page is the one meant for search.
  robots: { index: false, follow: true },
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  return <BookPageView lang="en" searchParams={await searchParams} />;
}
