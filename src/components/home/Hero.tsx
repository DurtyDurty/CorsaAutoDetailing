import { isPrelaunch, phoneLink, primaryCta } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { HeroSlideshow, type HeroSlide } from "@/components/site/HeroSlideshow";
import { TrustPoints } from "@/components/site/TrustPoints";
import { BOOKING_FORM_ID } from "@/components/site/MobileActionBar";
import { PhoneIcon } from "@/components/site/icons";

/**
 * Hero slideshow: just the animated logo for now. The owner took the job photos off (2026-10-29) until he has
 * better ones; add them back after the logo as { type: "photo", photo: photos.x }.
 */
const slides: HeroSlide[] = [{ type: "logo" }];

/** The Clay County towns the hero names (owner, 2026-10-28). */
const HERO_TOWNS = ["Green Cove Springs", "Fleming Island", "Middleburg", "Orange Park"];

function townList(lang: Lang) {
  const last = HERO_TOWNS.at(-1);
  return `${HERO_TOWNS.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${last}`;
}

/**
 * Phones: the slideshow as a strip above the text, so the car isn't hidden behind it, and the buttons and
 * trust chips inside the first screen. Desktop: text on the left, slideshow on the right.
 */
export function Hero({ lang }: { lang: Lang }) {
  const d = dict(lang).hero;
  const tel = phoneLink("tel");
  return (
    <section className="overflow-hidden bg-night text-chalk on-dark lg:grid lg:grid-cols-2">
      <div className="relative h-[24svh] min-h-44 sm:h-[44svh] lg:order-2 lg:h-auto lg:min-h-[42rem]">
        <HeroSlideshow slides={slides} label={d.photosLabel} />
      </div>

      <div className="carbon relative px-5 pb-10 pt-4 sm:px-8 sm:pb-14 lg:flex lg:flex-col lg:justify-center lg:py-20 lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] lg:pr-14">
        {/* First under the photos, so a phone shows them without scrolling (owner, 2026-10-25). */}
        <TrustPoints lang={lang} className="mb-4 lg:order-last lg:mb-0 lg:mt-6" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-apex">{d.eyebrow}</p>
        <h1 className="mt-3 font-display text-[2.6rem] leading-[0.95] text-balance sm:text-6xl xl:text-7xl">{d.title}</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-chalk/80 sm:mt-4 sm:text-lg">{d.sub(townList(lang))}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={isPrelaunch ? primaryCta().href : `#${BOOKING_FORM_ID}`}
            className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-apex-deep px-7 py-3.5 text-base font-semibold text-white hover:bg-[#a51824] sm:flex-none"
          >
            {isPrelaunch ? primaryCta().label : d.primary}
            <span aria-hidden="true">→</span>
          </a>
          {tel && (
            <a
              href={tel}
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-chalk/35 px-6 py-3.5 text-base font-semibold text-chalk hover:border-chalk"
            >
              <PhoneIcon />
              {d.secondary}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
