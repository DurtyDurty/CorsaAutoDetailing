import { business } from "@/config/business";
import { gallery } from "@/config/photos";
import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";
import { FlipCard } from "./FlipCard";

/** Empty slots show as placeholders on preview deployments and in development, never on the live site. */
const showPlaceholders = business.brand.siteEnv === "staging" || process.env.NODE_ENV !== "production";

/** Before/after grid (src/config/photos.ts `gallery`) plus the Instagram link once it's set. */
export function Gallery({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).gallery;
  const filled = gallery.filter((g) => g.before && g.after);
  const empty = showPlaceholders ? gallery.filter((g) => !(g.before && g.after)) : [];
  if (filled.length === 0 && empty.length === 0) return null;
  const instagram = business.contact.social.instagram;
  return (
    <Section tone="night2" id="gallery" labelledBy="gallery-title">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading id="gallery-title" num={num} title={d.title} lede={d.lede} onDark />
        {instagram && (
          <a href={instagram} rel="noopener" className="inline-flex min-h-11 items-center gap-2 font-semibold text-apex hover:underline">
            {d.instagram}
            <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
        {filled.map((g) => (
          <li key={g.before!.src} className="col-span-2 sm:col-span-1">
            <FlipCard before={g.before!} after={g.after!} caption={g.caption[lang]} labels={{ before: d.before, after: d.after, flip: d.flip(g.caption[lang]) }} />
          </li>
        ))}
        {empty.map((g, i) => (
          <li key={g.caption.en}>
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-night-3 p-3 text-center text-xs text-chalk/60 sm:p-6 sm:text-sm">
              <span className="race-num" aria-hidden="true">
                {String(filled.length + i + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold text-chalk/80">{g.caption[lang]}</span>
              {d.placeholder}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
