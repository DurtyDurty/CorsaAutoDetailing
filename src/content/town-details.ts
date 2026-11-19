import type { Lang } from "@/i18n/dictionary";
import type { FaqEntry } from "./home-faq";

/**
 * What makes each town page its own page (SEO, 2026-11-18): where we go in that town and a few local questions.
 * Without it every town page was the same packages and links with one different paragraph, and Google tends to
 * ignore near-duplicate city pages. Facts only: neighborhoods and roads are public geography, the answers follow
 * business rules already on the site (no travel surcharges, own water and power, home or workplace, Jacksonville
 * confirmed per address). Owner to check the neighborhood names (OWNER_DECISIONS.md).
 */
interface TownDetail {
  around: string;
  faq: FaqEntry[];
}

const GATED_EN: FaqEntry = {
  q: "Can you get into gated neighborhoods?",
  a: "Yes. Add the gate code or entry instructions to your booking notes, and let your HOA or front gate know we're coming if your community asks for that.",
};
const GATED_ES: FaqEntry = {
  q: "¿Pueden entrar a vecindarios con portón?",
  a: "Sí. Agrega el código del portón o las instrucciones de entrada en las notas de tu reserva, y avísale a tu asociación o a la caseta que vamos si tu comunidad lo pide.",
};
const WORK_EN: FaqEntry = {
  q: "Can you detail my car while I'm at work?",
  a: "Yes. We detail at workplaces as well as homes. We just need room to park the trailer next to your car, so add the address and any parking notes when you book.",
};
const WORK_ES: FaqEntry = {
  q: "¿Pueden detallar mi carro mientras estoy en el trabajo?",
  a: "Sí. Detallamos en lugares de trabajo además de casas. Solo necesitamos espacio para estacionar el tráiler junto a tu carro, así que agrega la dirección y cualquier nota de estacionamiento al reservar.",
};
const WATER_EN: FaqEntry = {
  q: "Do I need a hose or an outlet?",
  a: "No. The trailer carries its own water and its own power, so rural lots, long driveways and parking lots all work. We just need room to park next to your car.",
};
const WATER_ES: FaqEntry = {
  q: "¿Necesito manguera o enchufe?",
  a: "No. El tráiler lleva su propia agua y su propia electricidad, así que terrenos rurales, entradas largas y estacionamientos funcionan bien. Solo necesitamos espacio para estacionarnos junto a tu carro.",
};

const details: Record<string, Record<Lang, TownDetail>> = {
  middleburg: {
    en: {
      around:
        "We work all over the Middleburg area: off Blanding Boulevard, along CR-218 and CR-220, out toward Clay Hill and in the neighborhoods around Black Creek. Rural lots and long driveways are no problem.",
      faq: [
        {
          q: "Do you charge extra to come to Middleburg?",
          a: "No. Middleburg is our home base and part of our core service area, and there are no travel surcharges anywhere we serve.",
        },
        {
          q: "Can you detail a pickup or a three-row SUV?",
          a: "Yes. Pickups and three-row SUVs are priced one size up from a sedan, and you'll see the price for your vehicle when you book. Oversized or lifted trucks get a quick custom quote.",
        },
        WATER_EN,
      ],
    },
    es: {
      around:
        "Trabajamos en toda la zona de Middleburg: cerca de Blanding Boulevard, a lo largo de la CR-218 y la CR-220, hacia Clay Hill y en los vecindarios alrededor de Black Creek. Terrenos rurales y entradas largas no son problema.",
      faq: [
        {
          q: "¿Cobran extra por ir a Middleburg?",
          a: "No. Middleburg es nuestra base y parte de nuestra zona principal, y no cobramos recargo por traslado en ninguna zona que atendemos.",
        },
        {
          q: "¿Detallan camionetas pickup o SUVs de tres filas?",
          a: "Sí. Las pickups y las SUVs de tres filas cuestan un tamaño más que un sedán, y ves el precio para tu vehículo al reservar. Las camionetas extragrandes o levantadas reciben una cotización rápida aparte.",
        },
        WATER_ES,
      ],
    },
  },
  "fleming-island": {
    en: {
      around:
        "We come to homes across Fleming Island, from Fleming Island Plantation, Eagle Harbor and Pace Island to the streets off US-17 and CR-220, and to workplaces along the US-17 corridor.",
      faq: [
        {
          q: "My HOA has rules about washing cars. Can you still come?",
          a: "Some Fleming Island HOAs restrict washing in driveways, so check your association's rules first. If yours doesn't allow it, book the visit at your workplace instead, or tell us in your booking notes and we'll talk it through before the day.",
        },
        WORK_EN,
        GATED_EN,
      ],
    },
    es: {
      around:
        "Vamos a casas en todo Fleming Island, desde Fleming Island Plantation, Eagle Harbor y Pace Island hasta las calles cerca de la US-17 y la CR-220, y a lugares de trabajo a lo largo de la US-17.",
      faq: [
        {
          q: "Mi asociación de vecinos tiene reglas sobre lavar carros. ¿Igual pueden venir?",
          a: "Algunas asociaciones de Fleming Island limitan el lavado en la entrada, así que revisa primero las reglas de la tuya. Si no lo permite, reserva la visita en tu trabajo, o dínoslo en las notas y lo hablamos antes del día.",
        },
        WORK_ES,
        GATED_ES,
      ],
    },
  },
  "green-cove-springs": {
    en: {
      around:
        "We cover Green Cove Springs from downtown and the riverfront to Magnolia Point, Lake Asbury and the neighborhoods off US-17 and SR-16.",
      faq: [
        {
          q: "Is Green Cove Springs inside your core area?",
          a: "Yes. Green Cove Springs and the Lake Asbury area are core coverage, with no travel surcharge. Pick a day online and we'll confirm the exact time with your price.",
        },
        WORK_EN,
        GATED_EN,
      ],
    },
    es: {
      around:
        "Cubrimos Green Cove Springs desde el centro y la orilla del río hasta Magnolia Point, Lake Asbury y los vecindarios cerca de la US-17 y la SR-16.",
      faq: [
        {
          q: "¿Green Cove Springs está en su zona principal?",
          a: "Sí. Green Cove Springs y la zona de Lake Asbury son parte de nuestra zona principal, sin recargo por traslado. Elige un día en línea y te confirmamos la hora exacta con tu precio.",
        },
        WORK_ES,
        GATED_ES,
      ],
    },
  },
  "st-johns": {
    en: {
      around:
        "We work across northern St. Johns County: Fruit Cove, Julington Creek Plantation, RiverTown and the neighborhoods along SR-13 and CR-210.",
      faq: [
        {
          q: "Do you come across the river from Clay County?",
          a: "Yes. St. Johns is part of our core service area, with no travel surcharge. We plan routes by day, so pick the day that works and we'll confirm the exact time with your price.",
        },
        GATED_EN,
        WORK_EN,
      ],
    },
    es: {
      around:
        "Trabajamos en todo el norte del condado de St. Johns: Fruit Cove, Julington Creek Plantation, RiverTown y los vecindarios a lo largo de la SR-13 y la CR-210.",
      faq: [
        {
          q: "¿Cruzan el río desde el condado de Clay?",
          a: "Sí. St. Johns es parte de nuestra zona principal, sin recargo por traslado. Planeamos las rutas por día, así que elige el día que te sirva y te confirmamos la hora exacta con tu precio.",
        },
        GATED_ES,
        WORK_ES,
      ],
    },
  },
  orangedale: {
    en: {
      around:
        "We detail cars at homes along SR-13 and SR-16 around Orangedale, on the St. Johns County side of the Shands Bridge.",
      faq: [
        {
          q: "Is Orangedale far for you?",
          a: "No. It's a short drive over the Shands Bridge from Green Cove Springs, and it's part of our core service area with no travel surcharge.",
        },
        WATER_EN,
      ],
    },
    es: {
      around:
        "Detallamos carros en casas a lo largo de la SR-13 y la SR-16 alrededor de Orangedale, del lado del condado de St. Johns del puente Shands.",
      faq: [
        {
          q: "¿Orangedale les queda lejos?",
          a: "No. Está a pocos minutos de Green Cove Springs cruzando el puente Shands, y es parte de nuestra zona principal sin recargo por traslado.",
        },
        WATER_ES,
      ],
    },
  },
  "world-golf-village": {
    en: {
      around:
        "We come to homes and workplaces around World Golf Village, including Murabella, King and Bear and the neighborhoods along International Golf Parkway and SR-16.",
      faq: [
        GATED_EN,
        {
          q: "Do you come to townhomes and condos?",
          a: "Yes, as long as there's room to park the trailer next to your car and your community allows it. Check your association's rules and add any parking notes when you book.",
        },
      ],
    },
    es: {
      around:
        "Vamos a casas y lugares de trabajo alrededor de World Golf Village, incluidos Murabella, King and Bear y los vecindarios a lo largo de International Golf Parkway y la SR-16.",
      faq: [
        GATED_ES,
        {
          q: "¿Van a townhomes y condominios?",
          a: "Sí, siempre que haya espacio para estacionar el tráiler junto a tu carro y tu comunidad lo permita. Revisa las reglas de tu asociación y agrega notas de estacionamiento al reservar.",
        },
      ],
    },
  },
  jacksonville: {
    en: {
      around:
        "The parts of Jacksonville closest to our Clay County base, like Oakleaf, Argyle Forest, the Westside and Mandarin, are usually the easiest for us to reach. We take requests from the rest of Duval County too, and confirm each address before we book it.",
      faq: [
        {
          q: "Do you come to my part of Jacksonville?",
          a: "Most likely, if you're on the south or west side near Clay County. Jacksonville covers a lot of ground, so enter your ZIP or send a request and we'll confirm your address when we review it. If we can't reach you yet, we'll tell you clearly.",
        },
        {
          q: "Is there a travel fee for Jacksonville?",
          a: "No. There are no travel surcharges. If a location doesn't work for our route, we simply say so.",
        },
        WORK_EN,
      ],
    },
    es: {
      around:
        "Las partes de Jacksonville más cerca de nuestra base en el condado de Clay, como Oakleaf, Argyle Forest, el Westside y Mandarin, suelen ser las más fáciles para nosotros. También recibimos solicitudes del resto del condado de Duval, y confirmamos cada dirección antes de agendar.",
      faq: [
        {
          q: "¿Van a mi zona de Jacksonville?",
          a: "Lo más probable, si estás en el sur o el oeste, cerca del condado de Clay. Jacksonville es grande, así que pon tu código postal o envía una solicitud y confirmamos tu dirección al revisarla. Si todavía no llegamos a tu zona, te lo decimos con claridad.",
        },
        {
          q: "¿Cobran por traslado a Jacksonville?",
          a: "No. No cobramos recargo por traslado. Si una dirección no funciona para nuestra ruta, simplemente te lo decimos.",
        },
        WORK_ES,
      ],
    },
  },
};

export function townDetail(slug: string, lang: Lang): TownDetail | null {
  return details[slug]?.[lang] ?? null;
}
