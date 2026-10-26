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

/**
 * Before/after shots for the "Real results" section (/book and the home page). Our own work only.
 * To add one: put the image in public/media/work (resized, location data stripped, plates blurred)
 * and add an entry here with a caption. Order = display order. Empty = the section shows reviews only.
 */
export const beforeAfter: { photo: WorkPhoto; caption: string }[] = [
  { photo: photos.interiorBeforeAfter, caption: "Front seat and console, before and after" },
  // { photo: { src: "/media/work/your-photo.jpg", alt: "Describe what the photo shows", width: 1080, height: 1350 }, caption: "Short caption" },
];
