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
  /**
   * Discounts the customer claimed (first-time offer, military/veteran/first responder): what the owner should
   * take off in the quote, one per line. Not included in `total`. Shown wherever "Offer claimed" appears.
   */
  offer?: string;
  /** The customer ticked the military/veteran/first-responder box. */
  military?: boolean;
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
  /** Military, veteran or first responder. Recorded only; the owner applies it in the quote. */
  military?: boolean;
  /**
   * Optional add-ons the customer asked for (`business.additionalServices` with `optional`). Saved as $0 lines:
   * the quote shows them as "Priced on site" until the owner prices them, so they never change the total.
   */
  optionalAddOnIds?: string[];
}

// Ids are stored on leads: keep old ones (mud, other) so earlier requests still read correctly.
const CONDITION_FLAG_LABELS: Record<string, string> = {
  pet_hair: "Pets or pet hair",
  odor: "Smoke or odor",
  stains: "Stains",
  sand: "Sand or mud",
  bugs_tar: "Bugs, tar or sap",
  mud: "Heavy mud",
  other: "Other concern",
};

/** The booking form's optional add-ons, in config order; unknown ids are dropped. */
export function optionalAddOns(ids?: readonly string[]) {
  return business.additionalServices.filter((a) => a.optional && (ids === undefined || ids.includes(a.id)));
}

/** "Anything we should know?" on the booking form (2026-10-28), in this order. */
// "Smoke or odor" came off the form on 2026-10-28 (owner); its label above stays for older requests.
export const BOOKING_CONDITION_FLAGS = ["pet_hair", "stains", "sand", "bugs_tar"] as const;

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
  for (const a of optionalAddOns(input.optionalAddOnIds ?? [])) addOns.push({ label: a.name, amount: a.priceMin ?? 0 });

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
    ...offerFields(input, total),
    taxNotice: business.taxNotice,
    finalQuoteNotice: business.finalQuoteNotice,
  };
}

function offerFields(input: Pick<EstimateInput, "firstTimeOffer" | "military">, total: number): Pick<EstimateSnapshot, "offer" | "military"> {
  const military = Boolean(input.military && business.militaryDiscount.enabled);
  const lines = [
    input.firstTimeOffer && business.firstTimeOffer.enabled ? firstTimeOfferNote(total) : null,
    military ? militaryNote(total) : null,
  ].filter((l): l is string => Boolean(l));
  // Both offers say they can't be combined; the owner applies one.
  const offer = lines.length > 1 ? `${lines.join("; ")} (only one discount applies)` : lines[0];
  return { ...(offer && { offer }), ...(military && { military }) };
}

/**
 * The two lines quotes and invoices print under the vehicle: what the customer noted on the booking form,
 * and which discount they asked for. `offer` is the saved "Offer claimed" text (EstimateSnapshot.offer).
 */
export function requestNotes(conditionFlags: string[], offer: string | null | undefined): { noted: string | null; discount: string | null } {
  const discounts = [
    offer?.includes("First-time customer") ? "first-time customer" : null,
    offer?.includes("Military, veteran or first responder") ? "military, veteran or first responder" : null,
  ].filter(Boolean);
  return {
    noted: conditionFlags.length > 0 ? `Noted: ${conditionFlags.map(conditionFlagLabel).join(", ")}` : null,
    discount: discounts.length > 0 ? `Discount requested: ${discounts.join(" / ")}` : null,
  };
}

/** "Military, veteran or first responder: 10% off (about $15 off the $150 starting price)". */
export function militaryNote(startingPrice: number | null): string {
  const { percent } = business.militaryDiscount;
  if (startingPrice === null) return `Military, veteran or first responder: ${percent}% off`;
  const off = Math.round((startingPrice * percent) / 100);
  return `Military, veteran or first responder: ${percent}% off (about ${formatUsd(off)} off the ${formatUsd(startingPrice)} starting price)`;
}

/** "First-time customer: 10% off (about $20 off the $200 starting price)". */
export function firstTimeOfferNote(startingPrice: number | null): string {
  const { percent } = business.firstTimeOffer;
  if (startingPrice === null) return `First-time customer: ${percent}% off`;
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

/** An add-on's price for display: "$35-$75", "$50", or "Priced at inspection" when it has none. */
export function addOnPrice(a: { priceMin: number | null; priceMax: number | null }, lang: "en" | "es" = "en"): string {
  if (a.priceMin === null) return lang === "es" ? "Precio al revisar" : "Priced at inspection";
  return formatUsdRange(a.priceMin, a.priceMax ?? a.priceMin);
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

/** Price per vehicle size ("Sedan" $90, "SUV/Minivan" $105, "Truck" $120), or null when the package has one price for every size. */
export function sizePrices(service: Pick<ServiceDefinition, "price" | "sizeStep">): { size: string; price: number }[] | null {
  const step = service.sizeStep;
  if (!step) return null;
  return business.vehicleSizes.map((size, i) => ({ size, price: service.price + step * i }));
}

/**
 * Package to recommend for the checked `business.packageNeeds`: the highest per-visit package any of them
 * points to. A plan need (Corsa Club) recommends the plan instead, unless something checked needs the top
 * package; then the top package comes first and the plan is offered as the follow-up.
 */
export function recommendService(needIds: string[]): { service: ServiceDefinition; followUp: ServiceDefinition | null } | null {
  const wanted = business.packageNeeds.filter((n) => needIds.includes(n.id)).map((n) => getService(n.service));
  const visits = business.services.filter((s) => !s.plan);
  const monthly = wanted.find((s) => s?.plan) ?? null;
  const top = Math.max(-1, ...wanted.map((s) => visits.findIndex((v) => v.id === s?.id)));
  if (monthly && top < visits.length - 1) return { service: monthly, followUp: null };
  return top < 0 ? null : { service: visits[top], followUp: monthly };
}

/** Lowest one-time package price in a group, for "from $90" style copy. Plans (Corsa Club) don't count. */
export function groupStartingPrice(group: ServiceDefinition["group"]): number {
  return Math.min(...business.services.filter((s) => s.group === group && s.billing === "visit" && !s.plan).map((s) => s.price));
}
