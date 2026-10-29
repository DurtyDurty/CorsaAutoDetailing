import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { spanishAlternates } from "@/i18n/routes";

export const metadata: Metadata = {
  title: { absolute: "Detallado móvil de autos en el condado de Clay, FL | Corsa" },
  description:
    "Detallado móvil en Green Cove Springs, Fleming Island, Middleburg y Orange Park. Un tráiler con su propia agua y electricidad. Paquetes desde $90. Se habla español.",
  alternates: spanishAlternates("/"),
};

export default function InicioPage() {
  return <HomePage lang="es" />;
}
