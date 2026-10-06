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

export type ServiceId =
  | "signature-full"
  | "platinum-full"
  | "monthly-maintenance"
  | "signature-interior"
  | "full-works-interior"

  | "signature-exterior"
  | "wax-and-buff";
export type PackageGroupId = "popular" | "interior" | "exterior";

/** Vehicle sizes are no longer asked for (2026-09-30); kept so older leads still show a label. */
export interface VehicleCategory {
  id: VehicleCategoryId;
  label: string;
}

export interface PackageGroup {
  id: PackageGroupId;
  title: string;
  subtitle: string;
}

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  group: PackageGroupId;
  /** Short line under the name, e.g. "Bring It Back". */
  tagline: string | null;
  /** Optional ribbon, e.g. "Most popular". */
  badge: string | null;
  /** When set, the card shows "Everything in <that package>, plus:" above `includes`. */
  includesEverythingIn: ServiceId | null;
  /** Label above the list when it isn't "Everything in …" or "What's included". */
  includesHeading?: string;
  /** Only claim work and equipment you actually provide. */
  includes: string[];
  /** Starting price in USD, per visit or per month (see `billing`). */
  price: number;
  billing: "visit" | "monthly";
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
    /** Sunbiz search clear (2026-09-28); registration and a USPTO check are tracked in OWNER_DECISIONS.md. */
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
  pricingVersion: "2026-09-v9",
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
      "Protection durability is an estimate and depends on mileage, storage, weather exposure and maintenance practices.",
    inspection:
      "Final pricing is subject to an in-person vehicle inspection before service begins. Online prices are estimates based on vehicles in average condition. Vehicle size, condition, excessive pet hair, sand, mud, stains, odors, biological contamination, oxidation and other conditions requiring additional labor may affect the final price. Corsa Auto Detailing will inspect the vehicle, explain any recommended services or additional charges, and receive the customer’s approval before beginning work. Customers are under no obligation to accept additional services.",
  },

  vehicleCategories: [
    { id: "sedan", label: "Coupe or sedan" },
    { id: "suv2", label: "Small crossover or two-row SUV" },
    { id: "large", label: "Pickup truck or three-row SUV" },
    { id: "minivan", label: "Minivan" },
    { id: "oversized", label: "Oversized or lifted truck" },
    { id: "other", label: "Other" },
  ] satisfies VehicleCategory[],

  packageGroups: [
    { id: "popular", title: "Popular packages", subtitle: "Most booked" },
    { id: "interior", title: "Interior packages", subtitle: "Comprehensive deep cleaning" },
    { id: "exterior", title: "Exterior packages", subtitle: "Spotless exterior detailing" },
  ] satisfies PackageGroup[],

  // Ids are stable (URLs, saved leads); names changed 2026-09-30: signature-full = Essential Full Detail,
  // platinum-full = Signature Full Detail, signature-interior/-exterior = Essential Interior/Exterior,
  // full-works-interior = Signature Interior Detail, wax-and-buff = Signature Exterior Detail.
  services: [
    {
      id: "signature-full",
      name: "Essential Full Detail",
      group: "popular",
      tagline: null,
      badge: null,
      includesEverythingIn: null,
      includes: [
        "Exterior hand wash",
        "Sealant application",
        "Wheels cleaned",
        "Tire shine",
        "Interior vacuum",
        "Windows cleaned",
        "Interior surface cleaning",
      ],
      price: 179,
      billing: "visit",
    },
    {
      id: "platinum-full",
      name: "Signature Full Detail",
      group: "popular",
      tagline: "Bring It Back",
      badge: "Most popular",
      includesEverythingIn: "signature-full",
      includes: ["Clay bar treatment", "Steam and sanitation", "Full interior deep clean"],
      price: 299,
      billing: "visit",
    },
    {
      id: "monthly-maintenance",
      name: "Monthly Maintenance",
      group: "popular",
      tagline: "Keep It Fresh",
      badge: null,
      includesEverythingIn: null,
      includesHeading: "Preferred client",
      includes: [
        "1 exterior wash with sealant per month",
        "1 interior wash per month",
        "Priority booking",
        "15% off add-on services",
        "Exclusive client perks",
      ],
      price: 150,
      billing: "monthly",
    },
    {
      id: "signature-interior",
      name: "Essential Interior Detail",
      group: "interior",
      tagline: "Quick Refresh",
      badge: null,
      includesEverythingIn: null,
      // Air freshener left off on purpose (owner decision 2026-09-30).
      includes: ["Interior vacuum", "Quick interior wipe-down", "Floor mats detailed", "Trunk detailed", "Windows cleaned"],
      price: 125,
      billing: "visit",
    },
    {
      id: "full-works-interior",
      name: "Signature Interior Detail",
      group: "interior",
      tagline: "Bring It Back",
      badge: "Most popular",
      includesEverythingIn: "signature-interior",
      includes: [
        "Steam and sanitation",
        "Seats and carpets shampooed",
        "High-pressure air blasting",
        "UV protection on plastics",
        "Double vacuum",
      ],
      price: 225,
      billing: "visit",
    },
    {
      id: "signature-exterior",
      name: "Essential Exterior Detail",
      group: "exterior",
      tagline: "Quick Refresh",
      badge: null,
      includesEverythingIn: null,
      includes: ["Exterior hand wash", "Sealant application", "Wheels cleaned", "Tire shine", "Exterior windows cleaned"],
      price: 125,
      billing: "visit",
    },
    {
      id: "wax-and-buff",
      name: "Signature Exterior Detail",
      group: "exterior",
      tagline: "Showroom Shine",
      badge: null,
      includesEverythingIn: "signature-exterior",
      includes: ["Clay bar", "1-step paint enhancement", "Hand wax", "Plastic dressing"],
      price: 200,
      billing: "visit",
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
          "St. Johns, in northern St. Johns County, is just across the St. Johns River from Clay County. We bring full, interior and exterior detailing to homes and workplaces throughout the area.",
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
    /** Show the maintenance-plan interest page. Off since Monthly Maintenance became a package (2026-09-30); the page redirects to it. */
    enabled: false,
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

  /**
   * Online booking with deposits. Active only in LIVE mode with a payment
   * provider configured (STRIPE_SECRET_KEY, or the demo provider in tests).
   * Deposit amounts are server-trusted: the browser never sends a price.
   */
  booking: {
    /** Per package. Online booking stays off until every package has a deposit and a duration. */
    depositCents: {} as Partial<Record<ServiceId, number>>,
    /**
     * Calendar block per job: the upper end of the owner's estimate (2026-10-01):
     * Essential packages and Monthly Maintenance 2-3 hrs, Signature packages 4-5 hrs.
     */
    durationMinutes: {
      "signature-full": 180, // Essential Full Detail
      "signature-interior": 180, // Essential Interior Detail
      "signature-exterior": 180, // Essential Exterior Detail
      "monthly-maintenance": 180,
      "platinum-full": 300, // Signature Full Detail
      "full-works-interior": 300, // Signature Interior Detail
      "wax-and-buff": 300, // Signature Exterior Detail
    } as Partial<Record<ServiceId, number>>,
    slotIntervalMinutes: 30,
    /**
     * Customers pick Morning or Afternoon, then a preferred arrival time inside it
     * (every slotIntervalMinutes from "from" to "to", Eastern); the owner confirms
     * the exact time with the quote. One visit per window: once anything starts in
     * a window (from its "from" up to the next window), that window is taken. Each
     * visit still blocks its full length plus travel. Empty = every interval all day.
     */
    arrivalWindows: [
      { id: "morning", label: "Morning", from: "08:00", to: "11:00" },
      { id: "afternoon", label: "Afternoon", from: "12:00", to: "15:00" },
    ] as { id: string; label: string; from: string; to: string }[],
    /** Earliest bookable day = today + minDaysAhead (Eastern). */
    minDaysAhead: 1,
    maxDaysAhead: 30,
    /** How long a slot is held while the customer pays. Stripe Checkout expires at 30 min; this is longer so a late payment still finds its hold. */
    holdMinutes: 40,
    /** No-deposit calendar requests: the picked time is held this long for the owner to confirm (never past the start time). */
    requestHoldHours: 48,
    /**
     * Unpaid requests cost nothing to send, so the times they hold are rationed. Past
     * either limit a request is still saved for the owner, just without a held time.
     */
    maxOpenRequests: 6,
    maxOpenRequestsPerCustomer: 2,
    checkoutMinutes: 30,
    cancellationHours: 48,
    policyTextVersion: "2026-09-v1",
    policy: [
      "A deposit holds your appointment and is credited toward your final price.",
      "Cancel or reschedule at least 48 hours before your appointment for a full refund, or to move your deposit to a new date.",
      "Cancellations within 48 hours of the appointment, and no-shows, forfeit the deposit.",
      "If weather prevents the service, we reschedule at no charge and your deposit carries over.",
      "The remaining balance is due when the service is complete.",
    ],
    policyAgreementText: "I agree to the deposit, cancellation and weather policy above.",
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
    : { label: "Book a detail", href: "/request" };
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
