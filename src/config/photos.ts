/**
 * Real work photos from the owner (added 2026-10-21). Only our own work goes here: no stock or AI images.
 * Files are in public/media/work, already resized with location data stripped; the plate and house
 * numbers are blurred.
 */
export type WorkPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS object-position for cropped placements. */
  focus?: string;
};

export const photos = {
  stingerRear: {
    src: "/media/work/stinger-rear.jpg",
    alt: "Dark gray Kia Stinger after a detail, its paint reflecting the sky and clouds",
    width: 1350,
    height: 1800,
    focus: "42% 72%",
  },
  interiorBeforeAfter: {
    src: "/media/work/interior-before-after.jpg",
    alt: "Before and after of a front seat and center console: stained and dusty before, clean after",
    width: 1080,
    height: 1350,
  },
  stingerFront: {
    src: "/media/work/stinger-front.jpg",
    alt: "Front of the detailed Kia Stinger, the house reflected in its hood",
    width: 1350,
    height: 1800,
    focus: "50% 60%",
  },
  stingerDriveway: {
    src: "/media/work/stinger-driveway.jpg",
    alt: "The detailed Kia Stinger parked in a driveway",
    width: 1012,
    height: 1800,
    focus: "50% 58%",
  },
  onSiteSetup: {
    src: "/media/work/on-site-setup.jpg",
    alt: "Our trailer with its own generator, set up at the curb for a mobile detail on a blue Lexus",
    width: 1350,
    height: 1800,
    focus: "50% 42%",
  },
} satisfies Record<string, WorkPhoto>;

/** The before/after section on the home page. Off at the owner's request (2026-10-28); set true to bring it back. */
export const showGallery = false;

export interface GallerySlot {
  /** Both photos of the same spot. `null` = an empty slot, shown as a placeholder on preview deployments only. */
  before: WorkPhoto | null;
  after: WorkPhoto | null;
  caption: { en: string; es: string };
}

/**
 * Before/after gallery on the home page (tap a photo to flip it). Our own work only.
 * To fill a slot: put both images in public/media/work (resized, location data stripped, plates blurred),
 * then set `before` and `after` like the first entry. Order = display order. Slots still `null` are
 * hidden on the live site and shown as numbered placeholders on Vercel previews.
 */
export const gallery: GallerySlot[] = [
  {
    // Cropped from interior-before-after.jpg on 2026-10-28.
    before: { src: "/media/work/interior-before.jpg", alt: "Front seat and console before the detail: stained, dusty and dull", width: 513, height: 1118, focus: "50% 55%" },
    after: { src: "/media/work/interior-after.jpg", alt: "The same seat and console after the detail: clean fabric and a wiped-down console", width: 513, height: 1118, focus: "50% 55%" },
    caption: { en: "Front seat and console", es: "Asiento delantero y consola" },
  },
  { before: null, after: null, caption: { en: "Exterior paint", es: "Pintura exterior" } },
  { before: null, after: null, caption: { en: "Wheels and tires", es: "Rines y llantas" } },
  { before: null, after: null, caption: { en: "Carpets and floor mats", es: "Alfombras y tapetes" } },
  { before: null, after: null, caption: { en: "Pet hair removal", es: "Pelo de mascota" } },
  { before: null, after: null, caption: { en: "Dashboard and console", es: "Tablero y consola" } },
];
