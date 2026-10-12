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
  /** What the customer ticked in the "Not sure which package?" checklist, as shown to them. Absent when nothing was ticked. */
  needs?: string[];
  /** Set when the customer claimed the first-time offer: what the owner should take off in the quote. Not included in `total`. */
  offer?: string;
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
  /** Ids from `business.packageNeeds`. Recorded only; never changes the price. */
  needIds?: string[];
  /** The customer ticked the first-time offer. Recorded only; the owner applies it in the quote. */
  firstTimeOffer?: boolean;
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
  const needs = business.packageNeeds.filter((n) => input.needIds?.includes(n.id)).map((n) => n.label);

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
    ...(needs.length > 0 && { needs }),
    ...(input.firstTimeOffer && business.firstTimeOffer.enabled && { offer: firstTimeOfferNote(total) }),
    taxNotice: business.taxNotice,
    finalQuoteNotice: business.finalQuoteNotice,
  };
}

/** "First-time customer: 15% off (about $30 off the $200 starting price)". */
export function firstTimeOfferNote(startingPrice: number): string {
  const { percent } = business.firstTimeOffer;
  const off = Math.round((startingPrice * percent) / 100);
  return `First-time customer: ${percent}% off (about ${formatUsd(off)} off the ${formatUsd(startingPrice)} starting price)`;
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

/** Price per vehicle size ("Sedan" $90, "SUV" $105, "Truck" $120), or null when the package has one price for every size. */
export function sizePrices(service: Pick<ServiceDefinition, "price" | "sizeStep">): { size: string; price: number }[] | null {
  const step = service.sizeStep;
  if (!step) return null;
  return business.vehicleSizes.map((size, i) => ({ size, price: service.price + step * i }));
}

/**
 * Package to recommend for the checked `business.packageNeeds`: the highest per-visit package any of them
 * points to. A monthly need recommends the monthly package instead, unless something checked needs the top
 * package; then the top package comes first and the monthly one is offered as the follow-up.
 */
export function recommendService(needIds: string[]): { service: ServiceDefinition; followUp: ServiceDefinition | null } | null {
  const wanted = business.packageNeeds.filter((n) => needIds.includes(n.id)).map((n) => getService(n.service));
  const visits = business.services.filter((s) => s.billing === "visit");
  const monthly = wanted.find((s) => s?.billing === "monthly") ?? null;
  const top = Math.max(-1, ...wanted.map((s) => visits.findIndex((v) => v.id === s?.id)));
  if (monthly && top < visits.length - 1) return { service: monthly, followUp: null };
  return top < 0 ? null : { service: visits[top], followUp: monthly };
}

/** Lowest per-visit starting price in a package group, for "from $125" style copy. */
export function groupStartingPrice(group: ServiceDefinition["group"]): number {
  return Math.min(...business.services.filter((s) => s.group === group && s.billing === "visit").map((s) => s.price));
}
