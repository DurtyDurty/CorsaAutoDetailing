import { business, getService, getVehicleCategory, type ServiceDefinition } from "@/config/business";

export interface EstimateLine {
  label: string;
  amount: number;
}

export interface EstimateSnapshot {
  pricingVersion: string;
  serviceId: string;
  serviceName: string;
  /** Older estimates were priced by vehicle size; newer ones have none. */
  vehicleCategoryId: string | null;
  vehicleCategoryLabel: string | null;
  /** Older estimates: `null` when the vehicle category needed a custom quote. */
  basePrice: number | null;
  /** Missing on estimates saved before monthly packages existed (= "visit"). */
  billing?: ServiceDefinition["billing"];
  addOns: EstimateLine[];
  /** `null` when any component requires a custom quote. */
  total: number | null;
  requiresCustomQuote: boolean;
  /** Human-readable reasons the owner must review before quoting. Never change the price. */
  reviewNotes: string[];
  taxNotice: string;
  finalQuoteNotice: string;
}

export interface EstimateInput {
  serviceId: string;
  /** Recorded if supplied; never changes the price. */
  vehicleCategoryId?: string | null;
  addOnIds?: string[];
  condition?: "normal" | "deeper" | "unsure" | null;
  conditionFlags?: string[];
}

const CONDITION_FLAG_LABELS: Record<string, string> = {
  pet_hair: "Pet hair",
  stains: "Stains",
  odor: "Odors",
  sand: "Heavy sand",
  mud: "Heavy mud",
  other: "Other concern",
};

export function conditionFlagLabel(flag: string): string {
  return CONDITION_FLAG_LABELS[flag] ?? flag;
}

export const CONDITION_FLAGS = Object.keys(CONDITION_FLAG_LABELS);

/**
 * Compute a price estimate from configuration only. Condition and travel
 * answers never change the number — they only add review notes. The owner
 * approves any extra work and charge with the customer before service.
 */
export function computeEstimate(input: EstimateInput): EstimateSnapshot | null {
  const service = getService(input.serviceId);
  if (!service) return null;
  const vehicle = input.vehicleCategoryId ? getVehicleCategory(input.vehicleCategoryId) : undefined;
  const basePrice = service.price;

  const addOns: EstimateLine[] = (input.addOnIds ?? [])
    .map((id) => business.addOns.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ label: a.name, amount: a.price }));

  const reviewNotes: string[] = [];
  if (input.condition === "deeper") {
    reviewNotes.push("You indicated the vehicle needs deeper cleaning. We'll review scope with you before quoting.");
  } else if (input.condition === "unsure") {
    reviewNotes.push("Not sure about condition? No problem, we'll confirm together before quoting.");
  }
  const flags = (input.conditionFlags ?? []).filter((f) => f in CONDITION_FLAG_LABELS);
  if (flags.length > 0) {
    reviewNotes.push(
      `Noted: ${flags.map(conditionFlagLabel).join(", ").toLowerCase()}. We'll check this at inspection; any additional labor is explained and priced before we start, and only done with your approval.`,
    );
  }

  const total = basePrice + addOns.reduce((sum, a) => sum + a.amount, 0);

  return {
    pricingVersion: business.pricingVersion,
    serviceId: service.id,
    serviceName: service.name,
    vehicleCategoryId: vehicle?.id ?? null,
    vehicleCategoryLabel: vehicle?.label ?? null,
    basePrice,
    billing: service.billing,
    addOns,
    total,
    requiresCustomQuote: false,
    reviewNotes,
    taxNotice: business.taxNotice,
    finalQuoteNotice: business.finalQuoteNotice,
  };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "$35-$75", or "$50" when the range is a single price. */
export function formatUsdRange(min: number, max: number): string {
  return min === max ? formatUsd(min) : `${formatUsd(min)}-${formatUsd(max)}`;
}

/** "/mo" for monthly packages, "" otherwise. */
export function billingSuffix(billing: ServiceDefinition["billing"] | undefined): string {
  return billing === "monthly" ? "/mo" : "";
}

/** "$179" or "$150/mo". */
export function formatServicePrice(service: Pick<ServiceDefinition, "price" | "billing">): string {
  return `${formatUsd(service.price)}${billingSuffix(service.billing)}`;
}

/** Lowest per-visit starting price in a package group, for "from $125" style copy. */
export function groupStartingPrice(group: ServiceDefinition["group"]): number {
  return Math.min(...business.services.filter((s) => s.group === group && s.billing === "visit").map((s) => s.price));
}
