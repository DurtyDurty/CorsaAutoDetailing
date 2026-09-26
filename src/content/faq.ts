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
    q: "Is a request the same as an appointment?",
    a: "No. Every request is reviewed personally. You'll get a firm quote and, once we're open, a proposed time. Nothing is scheduled until you agree to it.",
  },
  {
    q: "Are the prices final?",
    a: `They're ${business.priceLabel[business.mode].toLowerCase()} for vehicles in routine condition. Your final quote is confirmed after we review your vehicle and location. ${business.taxNotice}`,
  },
  {
    q: "What if my car needs more than a maintenance clean?",
    a: "Heavy pet hair, embedded sand, stains, odors, polishing and similar work aren't part of the standard packages. Tell us about it in the request and we'll let you know what we can do and what it would cost — nothing extra is ever added without your approval.",
  },
  {
    q: "Do I need to provide water or power?",
    a: "We ask about it so we can plan the visit. It helps to know what's available, but the answer doesn't change your quote and isn't a requirement to book.",
  },
  {
    q: "Do you offer ceramic coatings, tint or paint protection film?",
    a: "Not at launch. We may add studio services later. You can register interest on the maintenance plans page so we know what to explore.",
  },
];

export const SERVICES_FAQ: FaqItem[] = [
  {
    q: "How long does a visit take?",
    a: "We'll publish typical durations once we've validated them on real vehicles. Until then, we'll give you a time estimate in your quote.",
  },
  {
    q: "Which vehicle category am I?",
    a: "Sedans and coupes are one category; two-row SUVs and crossovers another; large three-row SUVs and pickups a third. Minivans, oversized trucks and anything unusual are quoted individually. If you're not sure, choose \"Other / not sure\" and we'll confirm.",
  },
  {
    q: "Are there travel or condition surcharges?",
    a: "No hidden ones. If your location needs travel confirmation or your vehicle needs work outside the package, we tell you in the quote and you decide before anything happens.",
  },
];
