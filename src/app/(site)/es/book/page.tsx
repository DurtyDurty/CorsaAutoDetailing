import type { Metadata } from "next";
import { BookPageView } from "@/components/home/BookPageView";
import { spanishAlternates } from "@/i18n/routes";

export const metadata: Metadata = {
  title: "Agenda tu detallado móvil",
  description:
    "Agenda detallado móvil de autos en el condado de Clay, FL. Paquetes desde $90, en tu casa o trabajo, con un tráiler que lleva su propia agua y electricidad. No se cobra nada en línea.",
  alternates: spanishAlternates("/book"),
  robots: { index: false, follow: true },
};

export default async function AgendarPage({ searchParams }: PageProps<"/es/book">) {
  return <BookPageView lang="es" searchParams={await searchParams} />;
}
