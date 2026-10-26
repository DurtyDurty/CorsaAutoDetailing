import Image from "next/image";
import { business } from "@/config/business";
import { beforeAfter } from "@/config/photos";
import { Arrow } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Proof for the booking page: before/after photos (src/config/photos.ts `beforeAfter`) and
 * customer reviews (business.testimonials, word for word from Google). Both lists are filled
 * by hand with real material only; nothing here is ever written for a customer.
 * With no reviews yet, a "review us" link takes the reviews' place.
 */
export function RealResults({ tone = "white" }: { tone?: "chalk" | "white" }) {
  const reviews = business.testimonials;
  const reviewUrl = business.reviews.googleUrl;
  const profileUrl = reviewUrl?.replace(/\/review\/?$/, "") ?? null;
  if (reviews.length === 0 && beforeAfter.length === 0) return null;

  return (
    <Section tone={tone} id="reviews" className="scroll-mt-20">
      <SectionHeading title="Real results" lede="Our own work and our customers' own words." />

      {beforeAfter.length > 0 && (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {beforeAfter.map(({ photo, caption }) => (
            <li key={photo.src}>
              <figure className="overflow-hidden rounded-lg border border-line bg-white">
                <div className="relative aspect-[4/5]">
                  <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" className="object-cover" style={{ objectPosition: photo.focus ?? "center" }} />
                </div>
                <figcaption className="px-4 py-3 text-sm text-ink-muted">{caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      {reviews.length > 0 && (
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.name} className="flex flex-col gap-4 rounded-lg bg-white border border-line p-6">
              <p className="text-apex-deep text-lg tracking-[0.2em]" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
              </p>
              <blockquote className="leading-relaxed">&ldquo;{r.quote}&rdquo;</blockquote>
              <p className="mt-auto text-sm">
                <span className="font-semibold">{r.name}</span>
                <span className="text-ink-muted">
                  {r.location ? ` · ${r.location}` : ""} · {r.source} review
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {(profileUrl || reviewUrl) && (
        <a
          href={(reviews.length > 0 ? profileUrl : reviewUrl) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-8 inline-flex items-center gap-2 font-semibold text-apex-deep"
        >
          {reviews.length > 0 ? "Read our reviews on Google" : "Had us out? Review us on Google"}
          <Arrow />
        </a>
      )}
    </Section>
  );
}
