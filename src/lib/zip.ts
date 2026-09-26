import { business, type ZipEligibility } from "@/config/business";

export interface ZipLookup {
  eligibility: ZipEligibility;
  community: string | null;
  message: string;
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

/**
 * Classify a ZIP against the configured service areas. This is informational:
 * it never blocks a submission and never adds a travel charge. The owner
 * confirms eligibility when reviewing the request.
 */
export function lookupZip(zipRaw: string): ZipLookup {
  const zip = zipRaw.trim();
  for (const c of business.serviceAreas.communities) {
    if ((c.zips as readonly string[]).includes(zip)) {
      return c.coverage === "core"
        ? {
            eligibility: "core",
            community: c.name,
            message: `${c.name} is in our core service area.`,
          }
        : {
            eligibility: "confirm",
            community: c.name,
            message: `${c.name} is served at selected locations. We'll confirm travel eligibility when we review your request.`,
          };
    }
  }
  if ((business.serviceAreas.confirmZips as readonly string[]).includes(zip)) {
    return {
      eligibility: "confirm",
      community: null,
      message: `That ZIP is in ${business.serviceAreas.region} but outside our core communities. We'll confirm whether we can travel there.`,
    };
  }
  return {
    eligibility: "outside",
    community: null,
    message:
      "That ZIP is outside our initial service area. You're welcome to send the request — we'll let you know honestly if we can't reach you yet.",
  };
}
