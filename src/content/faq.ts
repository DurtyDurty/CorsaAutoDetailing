import { business } from "@/config/business";
import type { FaqItem } from "@/components/site/Faq";

export const HOME_FAQ: FaqItem[] = [
  {
    q: "When are you opening?",
    a: business.launchDate
      ? `We're planning to open on ${business.launchDate}. Launch-list members hear first if anything changes.`
      : "We don't have a confirmed opening date yet. We're finishing equipment purchases and practice work first. Join the launch list and we'll tell you the moment scheduling opens.",
  },
  {
    q: "Which package should I choose?",
    a: "For a complete reset inside and out, start with the Platinum Full Detail. If only the inside or the outside needs attention, choose one of the interior or exterior packages. After that, Monthly Maintenance keeps it fresh.",
  },
  {
    q: "Are the prices final?",
    a: `No. They're ${business.priceLabel[business.mode].toLowerCase()} for vehicles in average condition. We confirm the final price at an in-person inspection before any work begins, and nothing extra is done without your approval. ${business.taxNotice}`,
  },
  {
    q: "Is a request the same as an appointment?",
    a: "No. Every request is reviewed personally. You'll get a firm quote and, once we're open, a proposed time. Nothing is scheduled until you agree to it, and no payment is taken until availability and final pricing are confirmed.",
  },
  {
    q: "Do I need to provide water or power?",
    a: "We ask about it so we can plan the visit. It helps to know what's available, but the answer doesn't change your quote and isn't a requirement to book.",
  },
  {
    q: "Do you offer ceramic coating?",
    a: "Yes. The Ceramic Coating package comes in 1-, 3- and 5-year options; its starting price is on the services page. The Signature Exterior Detail's spray sealant is lighter protection and isn't a ceramic coating.",
  },
];

export const SERVICES_FAQ: FaqItem[] = [
  {
    q: "How long does a visit take?",
    a: "It depends on the package and on the vehicle's size and condition. We'll give you a time estimate with your quote.",
  },
  {
    q: "Does vehicle size change the price?",
    a: "Prices shown are starting prices. Larger vehicles, and vehicles that need extra work, can cost more. We confirm the final price at an in-person inspection before any work begins, and nothing extra is done without your approval.",
  },
  {
    q: "How long does the protection last?",
    a: `${business.disclosures.protection} Ceramic coating comes in 1-, 3- and 5-year options.`,
  },
  {
    q: "Are there travel or condition charges?",
    a: "No hidden ones. Excessive pet hair, sand, stains, odors, heavy mud and similar conditions can need extra labor. We'll explain it and price it at inspection, before we start, and you're under no obligation to accept.",
  },
];
