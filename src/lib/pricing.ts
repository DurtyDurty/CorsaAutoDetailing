import { business, getService, getVehicleCategory } from "@/config/business";

export interface EstimateLine {
  label: string;
  amount: number;
}

export interface EstimateSnapshot {
  pricingVersion: string;
  serviceId: string;
  serviceName: string;
  vehicleCategoryId: string;
  vehicleCategoryLabel: string;
  /** `null` when the vehicle category needs a custom quote. */
  basePrice: number | null;
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
  vehicleCategoryId: string;
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
  const vehicle = getVehicleCategory(input.vehicleCategoryId);
  if (!service || !vehicle) return null;

  const basePrice = vehicle.priced
    ? service.prices[vehicle.id as keyof typeof service.prices]
    : null;

  const addOns: EstimateLine[] = (input.addOnIds ?? [])
    .map((id) => business.addOns.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ label: a.name, amount: a.price }));

  const reviewNotes: string[] = [];
  if (!vehicle.priced) {
    reviewNotes.push(`${vehicle.label} vehicles receive a custom quote.`);
  }
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

  const requiresCustomQuote = basePrice === null;
  const total = requiresCustomQuote
    ? null
    : basePrice + addOns.reduce((sum, a) => sum + a.amount, 0);

  return {
    pricingVersion: business.pricingVersion,
    serviceId: service.id,
    serviceName: service.name,
    vehicleCategoryId: vehicle.id,
    vehicleCategoryLabel: vehicle.label,
    basePrice,
    addOns,
    total,
    requiresCustomQuote,
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

/** Lowest priced base for a service, for "from $120" style copy. */
export function startingPrice(serviceId: string): number | null {
  const service = getService(serviceId);
  if (!service) return null;
  return Math.min(...Object.values(service.prices));
}
