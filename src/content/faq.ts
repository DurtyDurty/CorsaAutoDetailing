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
    a: "If it's your first visit, or the vehicle needs more than routine upkeep, start with the Corsa Signature Detail. After that, the Corsa Essential Detail every four to six weeks keeps it clean.",
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
    q: "Is the Signature sealant a ceramic coating?",
    a: "No. The Signature Detail includes a ceramic paint sealant that provides up to 4-6 months of protection. It isn't a professionally installed ceramic coating, which we don't offer at launch.",
  },
];

export const SERVICES_FAQ: FaqItem[] = [
  {
    q: "How long does a visit take?",
    a: `About ${business.services.map((s) => `${s.duration} for the ${s.name}`).join(" and ")}. Vehicle size and condition can change that; we'll give you a time estimate with your quote.`,
  },
  {
    q: "Which vehicle size am I?",
    a: "Coupes and sedans are one size; small crossovers and two-row SUVs another; pickup trucks and three-row SUVs a third. Minivans, oversized or lifted trucks and anything unusual are quoted individually, so send us a message through the contact page. If you're between two sizes, pick the closer one and we'll confirm at inspection.",
  },
  {
    q: "How long does the protection last?",
    a: `${business.disclosures.protection} As a guide, the Signature Detail's ceramic sealant lasts up to 4-6 months.`,
  },
  {
    q: "Are there travel or condition charges?",
    a: "No hidden ones. Excessive pet hair, sand, stains, odors, heavy mud and similar conditions can need extra labor. We'll explain it and price it at inspection, before we start, and you're under no obligation to accept.",
  },
];
