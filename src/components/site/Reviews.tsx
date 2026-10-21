import { business } from "@/config/business";
import { Arrow } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";

/** Customer reviews, word for word from where they were posted. Renders nothing until there is one. */
export function Reviews({ tone = "chalk" }: { tone?: "chalk" | "white" }) {
  const reviews = business.testimonials;
  if (reviews.length === 0) return null;
  // The review link without "/review" opens the Business Profile, where every review can be read.
  const profileUrl = business.reviews.googleUrl?.replace(/\/review\/?$/, "") ?? null;
  const allFiveStar = reviews.every((r) => r.rating === 5);

  return (
    <Section tone={tone} id="reviews" className="scroll-mt-20">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <SectionHeading
          title="What customers say"
          lede={allFiveStar ? "Every review so far is five stars." : undefined}
        />
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 font-semibold text-apex-deep shrink-0"
          >
            Read our reviews on Google
            <Arrow />
          </a>
        )}
      </div>
      <ul className="mt-10 grid gap-5 md:grid-cols-2">
        {reviews.map((r) => (
          <li key={r.name} className="flex flex-col gap-5 rounded-lg bg-white border border-line p-6 sm:p-8">
            <p className="text-apex-deep text-xl tracking-[0.2em]" role="img" aria-label={`${r.rating} out of 5 stars`}>
              {"★".repeat(r.rating)}
            </p>
            <blockquote className="text-lg leading-relaxed">&ldquo;{r.quote}&rdquo;</blockquote>
            <p className="mt-auto text-sm">
              <span className="font-semibold">{r.name}</span>
              <span className="text-ink-muted">
                {r.location ? ` · ${r.location}` : ""} · {r.source} review
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
