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

export type ServiceId = "essential" | "signature";
export type PricedVehicleId = Extract<VehicleCategoryId, "sedan" | "suv2" | "large">;

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
  /** Short line used in the booking form and emails. */
  tagline: string;
  description: string;
  /** Owner-supplied estimate shown on the card. */
  duration: string;
  /** Optional ribbon, e.g. "Best First Visit". */
  badge: string | null;
  /** When set, the card shows "Everything in <that package>, plus:" above `includes`. */
  includesEverythingIn: ServiceId | null;
  includes: string[];
  /** Starting prices in USD by priced vehicle category. */
  prices: Record<PricedVehicleId, number>;
}

/** Extra work quoted as a range and confirmed at inspection. Never added to an online estimate automatically. */
export interface AdditionalService {
  id: string;
  name: string;
  priceMin: number;
  /** Same as priceMin for a flat price. */
  priceMax: number;
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
  /** Opening paragraph for the community's own SEO page. Facts only; verify local details (OWNER_DECISIONS.md). */
  intro: string;
  /** Publish /service-areas/<slug>. */
  page: boolean;
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
    tagline: "Driven by Detail.",
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
  pricingVersion: "2026-09-planned-v3",
  /** Shown next to all prices while in PRELAUNCH mode. */
  priceLabel: {
    PRELAUNCH: "Planned starting prices",
    LIVE: "Starting prices",
  } satisfies Record<BusinessMode, string>,
  taxNotice: "Any applicable tax will be disclosed in your final quote.",
  finalQuoteNotice: "Final price confirmed after an in-person inspection.",

  /** Owner-supplied disclosure copy. Keep wording exact; bump the version when it changes. */
  disclosures: {
    pricing:
      "Prices shown are starting prices and apply to vehicles in average condition. Final pricing may vary based on vehicle size and condition. Excessive pet hair, sand, stains, odors, biological contamination, heavy mud or neglected interiors may require additional labor and charges. Corsa Auto Detailing will disclose any additional charges before beginning the service.",
    protection:
      "Protection durability is an estimate and depends on mileage, storage, weather exposure and maintenance practices. The Signature Detail includes a ceramic sealant, not a professionally installed ceramic coating.",
    inspection:
      "Final pricing is subject to an in-person vehicle inspection before service begins. Online prices are estimates based on vehicles in average condition. Vehicle size, condition, excessive pet hair, sand, mud, stains, odors, biological contamination, oxidation and other conditions requiring additional labor may affect the final price. Corsa Auto Detailing will inspect the vehicle, explain any recommended services or additional charges, and receive the customer’s approval before beginning work. Customers are under no obligation to accept additional services.",
  },

  vehicleCategories: [
    { id: "sedan", label: "Coupe or sedan", examples: "Civic, Camry, Mustang, IS F", priced: true },
    { id: "suv2", label: "Small crossover or two-row SUV", examples: "RAV4, CR-V, CX-5, FJ Cruiser", priced: true },
    { id: "large", label: "Pickup truck or three-row SUV", examples: "F-150, Silverado, Tahoe, Highlander", priced: true },
    // Minivan / oversized / other were removed from the site 2026-09-28: those vehicles
    // are quoted through the contact page. The ids stay in VehicleCategoryId for older leads.
  ] satisfies VehicleCategory[],

  services: [
    {
      id: "essential",
      name: "Corsa Essential Detail",
      tagline: "Interior and exterior maintenance detail.",
      description:
        "A professional interior and exterior maintenance detail designed to keep a vehicle consistently clean, protected and presentable.",
      duration: "2-3 hours",
      badge: null,
      includesEverythingIn: null,
      includes: [
        "Pre-rinse and foam wash",
        "Safe hand wash",
        "Wheels, tires and wheel faces cleaned",
        "Door jambs wiped",
        "Exterior glass cleaned",
        "Professional tire dressing",
        "Paint sealant lasting approximately 4-8 weeks",
        "Thorough interior vacuum",
        "Dashboard, console and door panels cleaned",
        "Light crevice cleaning",
        "Interior glass cleaned",
        "Final quality inspection",
      ],
      prices: { sedan: 120, suv2: 160, large: 200 },
    },
    {
      id: "signature",
      name: "Corsa Signature Detail",
      tagline: "A complete reset with premium protection.",
      description:
        "A comprehensive vehicle reset combining deeper cleaning with premium exterior and interior protection. Recommended for first-time customers and vehicles needing more than routine maintenance.",
      duration: "4-6 hours",
      badge: "Best First Visit",
      includesEverythingIn: "essential",
      includes: [
        "Bug and tar treatment",
        "Iron-removal treatment",
        "Clay treatment",
        "Deeper wheel and tire cleaning",
        "Premium ceramic paint sealant providing up to 4-6 months of protection",
        "Exterior trim protection",
        "Detailed interior brushing and compressed-air cleaning",
        "Carpet and upholstery spot treatment",
        "Light extraction",
        "Leather cleaned and protected",
        "Interior UV protection",
        "Premium tire dressing",
        "Complimentary Corsa-branded air freshener",
      ],
      prices: { sedan: 275, suv2: 325, large: 375 },
    },
  ] satisfies ServiceDefinition[],

  /** Owner-approved fixed-price add-ons that the online estimate may add. None approved yet. */
  addOns: [] as FixedAddOn[],

  /** Priced as ranges; shown on the site and confirmed at inspection. Not added to online estimates. */
  additionalServices: [
    { id: "pet-hair", name: "Excessive pet-hair removal", priceMin: 35, priceMax: 75 },
    { id: "sand-mud", name: "Heavy sand or mud removal", priceMin: 30, priceMax: 75 },
    { id: "extraction", name: "Full carpet and seat extraction", priceMin: 50, priceMax: 100 },
    { id: "engine-bay", name: "Engine-bay detail", priceMin: 50, priceMax: 50 },
    { id: "headlights", name: "Headlight restoration", priceMin: 100, priceMax: 150 },
    { id: "paint-enhancement", name: "One-step paint enhancement", priceMin: 175, priceMax: 300 },
  ] satisfies AdditionalService[],

  /** Requires a custom quote regardless of package. */
  customQuoteConditions: [
    "Minivans, oversized or lifted trucks, and unusual vehicles (send us a message through the contact page)",
    "Heavily soiled or neglected vehicles",
  ],

  /** Services people ask about that are NOT offered at launch. Interest capture only. */
  futureServices: [
    "Paint protection film (PPF)",
    "Window tinting",
    "Professional ceramic coatings",
    "Multi-step paint correction",
  ],

  serviceAreas: {
    region: "Clay County, St. Johns & Jacksonville, FL",
    communities: [
      {
        slug: "middleburg",
        name: "Middleburg",
        county: "Clay",
        coverage: "core",
        blurb: "Home base territory. Driveways, garages, and quiet cul-de-sacs are ideal.",
        intro:
          "Middleburg is home base for Corsa Auto Detailing. We bring interior and exterior car detailing to driveways and garages across western Clay County, so your car gets a careful hand wash and real protection without you driving anywhere.",
        page: true,
        zips: ["32068"],
      },
      {
        slug: "fleming-island",
        name: "Fleming Island",
        county: "Clay",
        coverage: "core",
        blurb: "Core coverage, including the Eagle Harbor and Pace Island areas. Some HOAs restrict washing in driveways, so check yours.",
        intro:
          "Fleming Island sits on the St. Johns River along US-17, between Orange Park and Green Cove Springs. We detail cars at homes and workplaces across the island, including the Eagle Harbor and Pace Island neighborhoods.",
        page: true,
        zips: ["32003"],
      },
      {
        slug: "green-cove-springs",
        name: "Green Cove Springs",
        county: "Clay",
        coverage: "core",
        blurb: "Core coverage for the city and nearby Lake Asbury area.",
        intro:
          "Green Cove Springs is the Clay County seat, on the west bank of the St. Johns River. We cover the city and the nearby Lake Asbury area with mobile detailing at your home or workplace.",
        page: true,
        zips: ["32043"],
      },
      {
        slug: "st-johns",
        name: "St. Johns",
        county: "St. Johns",
        coverage: "core",
        blurb: "Northern St. Johns County, across the river from Clay County.",
        intro:
          "St. Johns, in northern St. Johns County, is just across the St. Johns River from Clay County. We bring the Corsa Essential and Signature details to homes and workplaces throughout the area.",
        page: true,
        zips: ["32259"],
      },
      {
        slug: "orangedale",
        name: "Orangedale",
        county: "St. Johns",
        coverage: "core",
        blurb: "On the St. Johns County side of the Shands Bridge, a short drive from Green Cove Springs.",
        intro:
          "Orangedale sits on the St. Johns County side of the Shands Bridge, a short drive from Green Cove Springs. We detail cars at homes and workplaces around Orangedale and along the river.",
        page: true,
        // ZIP not set: confirm which ZIP(s) you'll serve here (OWNER_DECISIONS.md).
        zips: [],
      },
      {
        slug: "world-golf-village",
        name: "World Golf Village",
        county: "St. Johns",
        coverage: "core",
        blurb: "Off I-95 in St. Johns County.",
        intro:
          "World Golf Village, off I-95 in St. Johns County, is part of our St. Johns County coverage. We come to your home or workplace for interior and exterior detailing.",
        page: true,
        zips: ["32092"],
      },
      {
        slug: "orange-park",
        name: "Orange Park",
        county: "Clay",
        coverage: "confirm",
        blurb: "Selected locations. Travel eligibility is confirmed when we review your request.",
        intro: "",
        page: false,
        zips: ["32065", "32073"],
      },
      {
        slug: "jacksonville",
        name: "Jacksonville",
        county: "Duval",
        coverage: "confirm",
        blurb: "Jacksonville mobile detailing at your home or workplace. Travel is confirmed for your exact location when we review your request.",
        intro:
          "Jacksonville mobile detailing at your home or workplace. Jacksonville covers a lot of ground, so we confirm travel for your exact address when we review your request, and we'll tell you plainly if we can't reach you yet.",
        page: true,
        // Duval County / City of Jacksonville ZIPs. Verify before launch (OWNER_DECISIONS.md).
        zips: [
          "32099", "32202", "32204", "32205", "32206", "32207", "32208", "32209", "32210", "32211", "32212",
          "32216", "32217", "32218", "32219", "32220", "32221", "32222", "32223", "32224", "32225", "32226",
          "32227", "32228", "32233", "32244", "32246", "32250", "32254", "32256", "32257", "32258", "32277",
        ],
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
      { id: "weekday-morning", label: "Weekday mornings (8-11am)" },
      { id: "weekday-midday", label: "Weekday midday (11am-2pm)" },
      { id: "weekday-afternoon", label: "Weekday afternoons (2-6pm)" },
      { id: "saturday", label: "Saturdays" },
      { id: "flexible", label: "Flexible (whatever is open)" },
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
    /** Required on booking requests; stored with a timestamp on the lead's consent record. */
    priceAcknowledgmentTextVersion: "2026-09-v1",
    priceAcknowledgmentText:
      "I understand that the displayed price is an estimate and that final pricing will be confirmed after Corsa Auto Detailing inspects my vehicle.",
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
