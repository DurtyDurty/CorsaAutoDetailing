import { business } from "@/config/business";
import type { LeadRecord } from "@/lib/leads/types";

/** Appended to every email the owner sends from the dashboard. */
export function ownerSignature(): string {
  const site = business.brand.canonicalDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return [business.owner.name, business.brand.name, business.contact.email, site].filter(Boolean).join("\n");
}

export function composeOwnerEmail(message: string): string {
  return `${message.trim()}\n\n${ownerSignature()}`;
}

export function defaultEmailSubject(lead: Pick<LeadRecord, "leadType">): string {
  switch (lead.leadType) {
    case "launch_list":
      return `Thanks for joining the ${business.brand.name} launch list`;
    case "quote_request":
      return `Your ${business.brand.name} request`;
    case "membership_interest":
      return `${business.brand.name} maintenance plans`;
    default:
      return `Following up from ${business.brand.name}`;
  }
}
