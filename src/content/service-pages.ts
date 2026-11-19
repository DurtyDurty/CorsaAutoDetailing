import { business, getService } from "@/config/business";
import { photos, type WorkPhoto } from "@/config/photos";
import { addOnPrice, formatUsd } from "@/lib/pricing";
import type { FaqEntry } from "./home-faq";

/**
 * One page per service people search for (SEO, 2026-11-18): /services/<slug>. Only work we actually do:
 * no ceramic coating, PPF, tint or multi-step correction (business.futureServices). Every package covers the
 * inside and the outside, so the interior and exterior pages say so instead of implying a separate package.
 * Prices and add-on ranges come from business.ts.
 */
export interface ServicePage {
  slug: string;
  /** Short name for links and breadcrumbs. */
  name: string;
  metaTitle: string;
  description: string;
  title: string;
  lede: string;
  photo: WorkPhoto;
  sections: { heading: string; body?: string; items?: { label: string; detail: string }[] }[];
  faq: FaqEntry[];
  /** Package preselected on /book. */
  bookService: string;
}

const area = "Clay County & Jacksonville, FL";
const svc = (id: string) => getService(id)!;
const addOn = (id: string) => business.additionalServices.find((a) => a.id === id)!;
const from = (id: string) => `from ${formatUsd(svc(id).price)}`;

export function servicePages(): ServicePage[] {
  const basic = svc("basic-full");
  const essential = svc("signature-full");
  const signature = svc("platinum-full");
  const petHair = addOn("pet-hair");
  const extraction = addOn("extraction");
  const enhancement = addOn("paint-enhancement");
  const headlights = addOn("headlight-restoration");

  return [
    {
      slug: "interior-car-detailing",
      name: "Interior car detailing",
      metaTitle: `Interior Car Detailing in ${area} | Corsa`,
      description: `Mobile interior car detailing at your home or work: seats, carpets, mats, dash, console and glass cleaned by hand. Full details ${from("signature-full")}, with an exterior wash included.`,
      title: "Interior car detailing at your home or work",
      lede: "Seats, carpets, mats, dash, console and glass cleaned by hand in your driveway or parking spot. Every package also includes an exterior wash, so the car comes back clean inside and out.",
      photo: photos.interiorBeforeAfter,
      sections: [
        {
          heading: "What each package does inside",
          items: [
            { label: `${basic.name}, ${from(basic.id)}`, detail: "A basic interior clean-up, for a car that just needs tidying." },
            {
              label: `${essential.name}, ${from(essential.id)}`,
              detail: "Full vacuum of seats and carpets, floor mats cleaned, dash, console and door panels wiped clean, UV protectant on the dash and plastics, door jambs wiped, and windows cleaned inside and out.",
            },
            {
              label: `${signature.name}, ${from(signature.id)}`,
              detail: `Everything in the ${essential.name}, plus a full interior deep clean and sanitation.`,
            },
          ],
        },
        {
          heading: "For heavier messes",
          body: "Some interiors need more than a package covers. These are priced after we see the vehicle, explained before we start, and only done with your OK.",
          items: [
            { label: `${extraction.name}, ${addOnPrice(extraction)}`, detail: "Carpets and cloth seats shampooed and extracted, for stains and ground-in dirt." },
            { label: `${petHair.name}, ${addOnPrice(petHair)}`, detail: "For hair woven into carpet and upholstery that a normal vacuum won't lift." },
          ],
        },
      ],
      faq: [
        {
          q: "Do you offer an interior-only detail?",
          a: `Every package covers the inside and the outside. If you mainly need the interior tidied, the ${basic.name} is the lightest option; for a real interior detail, book the ${essential.name} or the ${signature.name}.`,
        },
        {
          q: "Can you get out stains and odors?",
          a: "Stains and odors can need extra labor, like a full carpet and seat extraction. We look at them at the inspection, tell you what we can do and what it costs, and only start with your approval.",
        },
        {
          q: "How long does an interior detail take?",
          a: "It depends on the package and the vehicle's size and condition. You'll get a time estimate with your quote.",
        },
      ],
      bookService: essential.id,
    },
    {
      slug: "exterior-car-detailing",
      name: "Exterior detailing and hand wash",
      metaTitle: `Exterior Car Detailing in ${area} | Corsa`,
      description: `Mobile exterior car detailing: hand wash and hand dry, paint sealant, wheels and tires, clay bar and a 4-week sealant wax. At your home or work, full details ${from("signature-full")}.`,
      title: "Exterior car detailing and hand wash",
      lede: "A careful hand wash, real paint protection and clean wheels, done in your driveway or parking spot. The trailer brings its own water and power, and every package includes the interior too.",
      photo: photos.stingerFront,
      sections: [
        {
          heading: "What each package does outside",
          items: [
            { label: `${basic.name}, ${from(basic.id)}`, detail: "A basic exterior wash." },
            {
              label: `${essential.name}, ${from(essential.id)}`,
              detail: "Hand wash and hand dry, paint sealant for gloss and protection, wheels and tires deep cleaned, tire shine, and windows cleaned outside.",
            },
            {
              label: `${signature.name}, ${from(signature.id)}`,
              detail: `Everything in the ${essential.name}, plus a clay bar treatment and a 4-week paint sealant wax.`,
            },
          ],
        },
        {
          heading: "Optional add-ons",
          body: "Priced when we see the vehicle, and only added with your approval.",
          items: [
            { label: enhancement.name, detail: enhancement.description ?? "" },
            { label: headlights.name, detail: headlights.description ?? "" },
          ],
        },
      ],
      faq: [
        {
          q: "What does a clay bar treatment do?",
          a: `It lifts the bonded grit a wash leaves behind, the kind that makes paint feel rough to the touch, so the wax goes onto clean paint. It's part of the ${signature.name}.`,
        },
        {
          q: "How long does the protection last?",
          a: `The ${signature.name} uses a sealant wax built to last about four weeks. ${business.disclosures.protection}`,
        },
        {
          q: "Do you do ceramic coating or paint correction?",
          a: `Not right now: professional ceramic coatings and multi-step paint correction aren't offered yet. For light swirl marks, ask about ${enhancement.name.toLowerCase()}, a one-step machine polish finished with sealant.`,
        },
      ],
      bookService: signature.id,
    },
    {
      slug: "pet-hair-removal",
      name: "Pet hair removal",
      metaTitle: `Pet Hair Removal for Cars in ${area} | Corsa`,
      description: `Dog and cat hair removed from carpets and seats at your home or work. Excessive pet hair removal ${addOnPrice(petHair)}, added to a full detail and priced at inspection.`,
      title: "Pet hair removal for your car",
      lede: "Dog and cat hair weaves into carpet and seat fabric, and a quick vacuum won't pull it out. We remove it by hand as part of a full detail, in your driveway or parking spot.",
      photo: photos.interiorBeforeAfter,
      sections: [
        {
          heading: "How it's priced",
          items: [
            { label: "Light pet hair", detail: `Handled in the full vacuum that comes with the ${essential.name} and the ${signature.name}.` },
            {
              label: `${petHair.name}, ${addOnPrice(petHair)}`,
              detail: "For hair woven deep into carpet and upholstery. The price depends on how much there is, and we confirm it at the inspection before we start.",
            },
          ],
        },
        {
          heading: "Which package to book",
          body: `The ${signature.name} (${from(signature.id)}) is the usual pick for pet owners: it adds a full interior deep clean and sanitation to the ${essential.name}. Mention the pet hair when you book so we plan the time for it.`,
        },
      ],
      faq: [
        {
          q: "How much does pet hair removal cost?",
          a: `Light hair is covered by the package's vacuum. Excessive pet hair is ${addOnPrice(petHair)} on top of the package, priced at the inspection by how much there is, and only done with your approval.`,
        },
        {
          q: "Can you get rid of pet odor too?",
          a: `The ${signature.name} includes sanitation. Strong odors can need extra labor; we look at it at the inspection and tell you the price before we start.`,
        },
      ],
      bookService: signature.id,
    },
    {
      slug: "headlight-restoration",
      name: "Headlight restoration",
      metaTitle: `Headlight Restoration in ${area} | Corsa`,
      description: "Yellowed, cloudy headlights sanded, polished and sealed with a UV-protective coat, at your home or work. Added to any detailing package and priced at inspection.",
      title: "Headlight restoration",
      lede: `${headlights.description} Done at your home or workplace, added to any detailing package.`,
      photo: photos.stingerRear,
      sections: [
        {
          heading: "How it works",
          items: [
            { label: "Sand", detail: "The yellowed, oxidized outer layer of the lens is sanded off." },
            { label: "Polish", detail: "The lens is polished back to clear." },
            { label: "Seal", detail: "A UV-protective coat goes on to slow the yellowing from coming back." },
          ],
        },
        {
          heading: "Pricing",
          body: "Headlight restoration is an optional add-on, priced when we see the headlights and only done with your approval. Pick a package when you book and add headlight restoration, or mention it in your notes.",
        },
      ],
      faq: [
        {
          q: "Why do headlights turn yellow?",
          a: "Headlight lenses are plastic with a thin factory coating. Years of Florida sun break that coating down, and the plastic oxidizes, turning yellow and cloudy.",
        },
        {
          q: "How much does headlight restoration cost?",
          a: "It's priced at the inspection, once we see the condition of the lenses, and only added with your approval.",
        },
      ],
      bookService: essential.id,
    },
  ];
}

export function servicePage(slug: string): ServicePage | undefined {
  return servicePages().find((p) => p.slug === slug);
}
