import { business, shownReviews } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Real Google reviews (business.testimonials), word for word. Renders nothing until there are
 * business.reviews.minToShow of them. Never filled with placeholder or invented reviews.
 */
export function ReviewsSection({ lang, num }: { lang: Lang; num: number }) {
  const reviews = shownReviews();
  if (reviews.length === 0) return null;
  const d = dict(lang).reviews;
  const profileUrl = business.reviews.googleUrl?.replace(/\/review\/?$/, "") ?? null;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  return (
    <Section tone="night2" id="reviews" labelledBy="reviews-title">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading id="reviews-title" num={num} title={d.title} lede={d.lede} onDark />
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-apex hover:underline">
            {d.seeAll} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.name} className="flex flex-col gap-4 rounded-lg border border-white/10 bg-night-3 p-6">
            <p className="text-lg tracking-[0.2em] text-apex" role="img" aria-label={d.stars(r.rating)}>
              {"★".repeat(r.rating)}
            </p>
            {/* Reviews are quoted in the language they were written in. */}
            <blockquote lang="en" className="leading-relaxed">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <p className="mt-auto text-sm text-chalk/70">
              <span className="font-semibold text-chalk">{r.name}</span>
              {r.date && ` · ${date(r.date)}`} · {r.source}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
