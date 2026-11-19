import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { spanishAlternates } from "@/i18n/routes";
import { groupStartingPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: { absolute: "Detallado móvil de autos en Clay y Jacksonville, FL | Corsa" },
  description: `Detallado móvil en tu casa o trabajo en Middleburg, Fleming Island, Green Cove Springs, Orange Park y Jacksonville. Nuestro tráiler lleva su propia agua y electricidad. Desde $${groupStartingPrice("popular")}. Se habla español.`,
  alternates: spanishAlternates("/"),
};

export default function InicioPage() {
  return <HomePage lang="es" />;
}
