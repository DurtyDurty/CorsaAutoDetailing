import { business, getService } from "@/config/business";
import type { Lang } from "@/i18n/dictionary";
import { formatUsd } from "@/lib/pricing";

export interface FaqEntry {
  q: string;
  a: string;
  /** Set when the question itself is in another language than the page (the ¿Hablan español? item). */
  lang?: Lang;
}

/**
 * Home page FAQ (also the FAQPage structured data). Prices, the discount and Corsa Club come from
 * business.ts, so the answers can't drift from the packages.
 */
export function homeFaq(lang: Lang): FaqEntry[] {
  const [basic, essential, signature] = ["basic-full", "signature-full", "platinum-full"].map((id) => getService(id)!);
  const club = getService("monthly-maintenance")!;
  const pct = business.militaryDiscount.percent;
  if (lang === "es") {
    return [
      {
        q: "¿Qué zonas atienden?",
        a: "Nuestra base es el condado de Clay: Middleburg, Fleming Island y Green Cove Springs, además de St. Johns, Orangedale y World Golf Village. En Orange Park, Jacksonville y otras direcciones cercanas confirmamos el traslado cuando revisamos tu solicitud.",
      },
      {
        q: "¿Tengo que poner el agua o la electricidad?",
        a: "No. Nuestro tráiler lleva su propia agua y su propia electricidad. Solo necesitamos espacio para estacionarnos junto a tu carro.",
      },
      {
        q: "¿Cuánto cuesta?",
        a: `Para un sedán, el ${basic.name} empieza en ${formatUsd(basic.price)}, el ${essential.name} en ${formatUsd(essential.price)} y el ${signature.name} en ${formatUsd(signature.price)}. SUVs y camionetas cuestan un poco más. Confirmamos el precio final al ver el carro, antes de empezar.`,
      },
      {
        q: "¿Cómo se agenda?",
        a: "Elige un paquete y un día en línea, y si prefieres mañana o tarde. Apartamos ese horario y te mandamos el precio con la hora exacta. Tu cita queda confirmada cuando aceptas. No se cobra nada en línea.",
      },
      {
        q: "¿Qué es el Corsa Club?",
        a: `Un plan de mantenimiento para después de tu primer detallado completo: volvemos cada dos semanas para lavado a mano, rines y marcos de puertas, aspirado y limpieza interior, y vidrios, por ${formatUsd(club.price)} por visita.`,
      },
      {
        q: "¿Tienen descuento para militares?",
        a: `Sí. Militares activos, veteranos y personal de primera respuesta tienen ${pct}% de descuento. Marca la casilla al agendar y lo descontamos de tu cotización final. Se aplica un solo descuento por visita.`,
      },
      { q: "¿Hablan español?", a: "Sí, claro. Puedes escribirnos, llamarnos o agendar en español." },
    ];
  }
  return [
    {
      q: "Which areas do you serve?",
      a: "Clay County is home: Middleburg, Fleming Island and Green Cove Springs, plus St. Johns, Orangedale and World Golf Village. Orange Park, Jacksonville and other nearby addresses are confirmed when we review your request.",
    },
    {
      q: "Do I need to provide water or power?",
      a: "No. Our trailer carries its own water and its own power. We just need room to park next to your car.",
    },
    {
      q: "How much does it cost?",
      a: `For a sedan, the ${basic.name} starts at ${formatUsd(basic.price)}, the ${essential.name} at ${formatUsd(essential.price)} and the ${signature.name} at ${formatUsd(signature.price)}. SUVs and trucks cost a little more. We confirm the final price when we see the car, before any work starts.`,
    },
    {
      q: "How does booking work?",
      a: "Pick a package and a day online, morning or afternoon. We hold that time, then send you a price with the exact arrival time. Your appointment is confirmed when you accept. Nothing is charged online.",
    },
    {
      q: "What is Corsa Club?",
      a: `A maintenance plan for after your first full detail: we come back every two weeks for a hand wash, wheels and door jambs, an interior vacuum and wipe-down, and glass, for ${formatUsd(club.price)} a visit.`,
    },
    {
      q: "Do you offer a military discount?",
      a: `Yes. Active military, veterans and first responders get ${pct}% off. Tick the box when you book and we take it off your final quote. One discount applies per visit.`,
    },
    { q: "¿Hablan español?", a: "Sí. Se habla español. Text us, call us or book in Spanish anytime.", lang: "es" },
  ];
}
