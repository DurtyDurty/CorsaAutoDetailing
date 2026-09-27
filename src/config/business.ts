/**
 * Central business configuration for Corsa Auto Detailing.
 *
 * Everything the public site says about the business — name, contact details,
 * services, prices, service areas, feature flags — lives here or is read from
 * environment variables here. Change values in this file (or in .env) rather
 * than editing page copy.
 *
 * Unknown values are `null`/empty on purpose. The UI omits anything that is
 * not configured instead of showing a placeholder. See OWNER_DECISIONS.md.
 */

export type BusinessMode = "PRELAUNCH" | "LIVE";

export type VehicleCategoryId =
  | "sedan"
  | "suv2"
  | "large"
  | "minivan"
  | "oversized"
  | "other";

export type ServiceId = "exterior" | "full";

export interface VehicleCategory {
  id: VehicleCategoryId;
  label: string;
  examples: string;
  /** Categories without a fixed base price require a custom quote. */
  priced: boolean;
}

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  tagline: string;
  description: string;
  includes: string[];
  /** Base prices in USD by priced vehicle category. */
  prices: Record<Extract<VehicleCategoryId, "sedan" | "suv2" | "large">, number>;
}

export interface FixedAddOn {
  id: string;
  name: string;
  price: number;
  description: string;
}

export type ZipEligibility = "core" | "confirm" | "outside";

export interface ServiceAreaCommunity {
  slug: string;
  name: string;
  county: string;
  coverage: "core" | "confirm";
  blurb: string;
  /** ZIP codes the owner has associated with this community. Verify before launch. */
  zips: string[];
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : null;
}

function envMode(): BusinessMode {
  // NEXT_PUBLIC_ so server and client components agree on the mode.
  return process.env.NEXT_PUBLIC_BUSINESS_MODE === "LIVE" ? "LIVE" : "PRELAUNCH";
}

/** Public, browser-safe values must come from NEXT_PUBLIC_* variables. */
const canonicalDomain = env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

export const business = {
  brand: {
    /** Provisional working name. Name/trademark/domain clearance is still pending. */
    name: "Corsa Auto Detailing",
    shortName: "Corsa",
    tagline: "Thoughtful car care. Right at your driveway.",
    /** Logo files. `null` = not supplied; the UI falls back to a text wordmark. */
    logos: {
      /** Dark ink for light backgrounds; light ink for dark backgrounds. Source vector: public/brand/logo-master.svg. */
      horizontalDark: "/brand/logo-dark.svg" as string | null,
      horizontalLight: "/brand/logo-light.svg" as string | null,
      stackedDark: null as string | null,
      stackedLight: null as string | null,
    },
    canonicalDomain,
    /** Set NEXT_PUBLIC_SITE_ENV=staging to noindex an entire deployment. */
    siteEnv: (env("NEXT_PUBLIC_SITE_ENV") ?? "production") as "production" | "staging",
  },

  owner: {
    name: "Herson Sanchez",
    /** Shows the "Veteran owned" badge with the U.S. flag (hero, About, footer). */
    veteranOwned: true,
  },

  contact: {
    email: env("NEXT_PUBLIC_CONTACT_EMAIL"),
    phone: env("NEXT_PUBLIC_CONTACT_PHONE"),
    /** Human-readable hours when you actually reply to messages, e.g. "Mon–Sat, 9am–6pm ET". `null` = don't claim any. */
    responseHours: env("NEXT_PUBLIC_RESPONSE_HOURS"),
    social: {
      instagram: env("NEXT_PUBLIC_SOCIAL_INSTAGRAM"),
      facebook: env("NEXT_PUBLIC_SOCIAL_FACEBOOK"),
    },
  },

  mode: envMode(),
  /** ISO date (YYYY-MM-DD) of a confirmed opening date. Never invent one. */
  launchDate: env("NEXT_PUBLIC_LAUNCH_DATE"),
  timeZone: "America/New_York",

  /**
   * Bump whenever a price or service scope changes. Stored with each lead's
   * estimate so old inquiries can be understood later.
   */
  pricingVersion: "2026-09-planned-v2",
  /** Shown next to all prices while in PRELAUNCH mode. */
  priceLabel: {
    PRELAUNCH: "Planned starting prices",
    LIVE: "Starting prices",
  } satisfies Record<BusinessMode, string>,
  taxNotice: "Any applicable tax will be disclosed in your final quote.",
  finalQuoteNotice: "Final quote confirmed after vehicle and location review.",

  vehicleCategories: [
    { id: "sedan", label: "Sedan / coupe", examples: "Camry, Civic, IS F, Mustang", priced: true },
    { id: "suv2", label: "Mid-size SUV / crossover", examples: "RAV4, CX-5, FJ Cruiser, Model Y", priced: true },
    { id: "large", label: "XL SUV / truck", examples: "Tahoe, Expedition, F-150, Silverado", priced: true },
    { id: "minivan", label: "Minivan", examples: "Odyssey, Sienna, Pacifica", priced: false },
    { id: "oversized", label: "Oversized / lifted / dually", examples: "F-250 dually, lifted trucks, vans", priced: false },
    { id: "other", label: "Other / not sure", examples: "Anything unusual", priced: false },
  ] satisfies VehicleCategory[],

  services: [
    {
      id: "exterior",
      name: "Exterior Wash & Protect",
      tagline: "A careful hand wash with a layer of protection.",
      description:
        "For vehicles that are driven daily and kept in reasonable shape. Everything is done by hand at your location.",
      includes: [
        "Hand wash and hand dry",
        "Wheel faces and tires cleaned",
        "Tire dressing",
        "Exterior glass",
        "Quick spray protection",
      ],
      prices: { sedan: 79, suv2: 89, large: 109 },
    },
    {
      id: "full",
      name: "Full Detail",
      tagline: "Inside and out, sealed for up to 3 months.",
      description:
        "A complete inside-and-out clean finished with a protectant that lasts up to 3 months. Done by hand at your location.",
      includes: [
        "Hand wash and hand dry",
        "Wheel faces and tires cleaned, tire dressing",
        "Exterior and interior glass",
        "Interior vacuum",
        "Dashboard, console, and surface wipe-down",
        "3-month protectant",
      ],
      prices: { sedan: 140, suv2: 160, large: 200 },
    },
  ] satisfies ServiceDefinition[],

  /** Owner-approved fixed-price add-ons. None approved yet. */
  addOns: [] as FixedAddOn[],

  /** Work these packages do not include. Anything here needs a separate review and quote. */
  exclusions: [
    "Heavy pet hair",
    "Embedded sand",
    "Extensive mud",
    "Stain extraction",
    "Odor remediation",
    "Machine polishing or paint correction",
    "Engine-bay work",
    "Child-seat disassembly or cleaning",
  ],

  /** Requires a custom quote regardless of package. */
  customQuoteConditions: [
    "Minivans, oversized trucks, and unusual vehicles",
    "Heavily soiled vehicles",
    "Anything listed under exclusions",
  ],

  /** Services people ask about that are NOT offered at launch. Interest capture only. */
  futureServices: ["Paint protection film (PPF)", "Window tinting", "Ceramic coatings", "Paint correction"],

  serviceAreas: {
    region: "Clay County, Florida",
    communities: [
      {
        slug: "middleburg",
        name: "Middleburg",
        county: "Clay",
        coverage: "core",
        blurb: "Home base territory. Driveways, garages, and quiet cul-de-sacs are ideal.",
        zips: ["32068"],
      },
      {
        slug: "fleming-island",
        name: "Fleming Island",
        county: "Clay",
        coverage: "core",
        blurb: "Core coverage, including the Eagle Harbor and Pace Island areas. Some HOAs restrict washing in driveways — check yours.",
        zips: ["32003"],
      },
      {
        slug: "green-cove-springs",
        name: "Green Cove Springs",
        county: "Clay",
        coverage: "core",
        blurb: "Core coverage for the city and nearby Lake Asbury area.",
        zips: ["32043"],
      },
      {
        slug: "orange-park",
        name: "Orange Park",
        county: "Clay",
        coverage: "confirm",
        blurb: "Selected locations. Travel eligibility is confirmed when we review your request.",
        zips: ["32065", "32073"],
      },
    ] satisfies ServiceAreaCommunity[],
    /**
     * ZIPs outside the communities above that are still inside the county and
     * may be reachable with travel confirmation. Verify before launch.
     */
    confirmZips: ["32079", "32656", "32234"],
  },

  membership: {
    /** Show the maintenance-plan interest page and home section. */
    enabled: true,
    /** Set to true only when prices, terms, and a payment provider are approved. */
    billingEnabled: false,
    /** Unset on purpose: no invented prices. */
    prices: null as null | { monthly: number; twiceMonthly: number },
    cadences: [
      { id: "monthly", label: "Monthly visit" },
      { id: "twice-monthly", label: "Twice-monthly visit" },
    ],
  },

  /** Approved real-work photos. Empty = gallery hidden. */
  gallery: [] as { src: string; alt: string; width: number; height: number }[],
  /** Verified customer testimonials only. Empty = section hidden. */
  testimonials: [] as { quote: string; name: string; location: string }[],
  promotions: [] as { title: string; detail: string }[],

  scheduling: {
    /** Owner-defined default work hours in Eastern time, 24h clock. */
    workHours: { start: "08:00", end: "18:00" },
    /** 0 = Sunday … 6 = Saturday */
    workDays: [1, 2, 3, 4, 5, 6],
    /** Minutes reserved between confirmed appointments for travel and setup. */
    travelBufferMinutes: 45,
    /** Default appointment duration used for conflict checks until validated. */
    defaultDurationMinutes: 120,
    timeWindows: [
      { id: "weekday-morning", label: "Weekday mornings (8–11am)" },
      { id: "weekday-midday", label: "Weekday midday (11am–2pm)" },
      { id: "weekday-afternoon", label: "Weekday afternoons (2–6pm)" },
      { id: "saturday", label: "Saturdays" },
      { id: "flexible", label: "Flexible — whatever is open" },
    ],
  },

  analytics: {
    provider: (env("NEXT_PUBLIC_ANALYTICS_PROVIDER") ?? "none") as "none" | "plausible" | "console",
    plausibleDomain: env("NEXT_PUBLIC_PLAUSIBLE_DOMAIN"),
  },

  consent: {
    serviceTextVersion: "2026-09-v1",
    serviceText:
      "I understand Corsa Auto Detailing will use the details I provide to review and respond to this request.",
    marketingTextVersion: "2026-09-v1",
    marketingText:
      "Email me occasional launch news, availability updates, and offers from Corsa Auto Detailing. I can unsubscribe any time.",
    smsMarketingEnabled: false,
  },
} as const;

export type Business = typeof business;

export const isPrelaunch = business.mode === "PRELAUNCH";

export function primaryCta(): { label: string; href: string } {
  return isPrelaunch
    ? { label: "Join the launch list", href: "/#launch-list" }
    : { label: "Request an appointment", href: "/request" };
}

export function getService(id: string): ServiceDefinition | undefined {
  return business.services.find((s) => s.id === id);
}

export function getVehicleCategory(id: string): VehicleCategory | undefined {
  return business.vehicleCategories.find((v) => v.id === id);
}

export function absoluteUrl(path: string): string {
  return new URL(path, business.brand.canonicalDomain).toString();
}
