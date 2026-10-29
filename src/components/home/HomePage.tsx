import { BusinessJsonLd } from "@/components/site/JsonLd";
import type { Lang } from "@/i18n/dictionary";
import { Hero } from "./Hero";
import { WhyCorsa } from "./WhyCorsa";
import { Packages } from "./Packages";
import { Gallery } from "./Gallery";
import { CorsaClub } from "./CorsaClub";
import { BookingSteps } from "./BookingSteps";
import { ServiceArea } from "./ServiceArea";
import { ReviewsSection } from "./ReviewsSection";
import { FaqSection } from "./FaqSection";
import { BookingSection } from "./BookingSection";
import { gallery, showGallery } from "@/config/photos";
import { business, shownReviews } from "@/config/business";

/**
 * The one-page home (2026-10-28 redesign), in either language. Sections are numbered like race cars in the
 * order they appear; a section that's hidden (no gallery photos, fewer than 3 reviews) doesn't take a number.
 */
export function HomePage({ lang }: { lang: Lang }) {
  const gallerySection = showGallery && (gallery.some((g) => g.before && g.after) || business.brand.siteEnv === "staging" || process.env.NODE_ENV !== "production");
  const showReviews = shownReviews().length > 0;
  let n = 0;
  const next = () => ++n;
  const sections = [
    <WhyCorsa key="why" lang={lang} num={next()} />,
    <Packages key="packages" lang={lang} num={next()} />,
    // Right after the prices (owner, 2026-10-28): see the packages, then book.
    <BookingSection key="book" lang={lang} num={next()} />,
    ...(gallerySection ? [<Gallery key="gallery" lang={lang} num={next()} />] : []),
    <CorsaClub key="club" lang={lang} num={next()} />,
    <BookingSteps key="steps" lang={lang} num={next()} />,
    <ServiceArea key="area" lang={lang} num={next()} />,
    ...(showReviews ? [<ReviewsSection key="reviews" lang={lang} num={next()} />] : []),
    <FaqSection key="faq" lang={lang} num={next()} />,
  ];
  return (
    <div lang={lang}>
      <BusinessJsonLd lang={lang} withOffers={false} />
      <Hero lang={lang} />
      {sections.map((s) =>
        // The booking form stays fully rendered: it's where "Book" jumps to.
        s.key === "book" ? (
          s
        ) : (
          <div key={s.key} className="cv-auto">
            {s}
          </div>
        ),
      )}
    </div>
  );
}
