import { business } from "@/config/business";
import type { FaqItem } from "@/components/site/Faq";

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
    a: business.disclosures.protection,
  },
  {
    q: "Are there travel or condition charges?",
    a: "No hidden ones. Excessive pet hair, sand, stains, odors, heavy mud and similar conditions can need extra labor. We'll explain it and price it at inspection, before we start, and you're under no obligation to accept.",
  },
];
