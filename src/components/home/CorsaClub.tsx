import Link from "next/link";
import { getService, isPrelaunch } from "@/config/business";
import { dict, localePath, type Lang } from "@/i18n/dictionary";
import { formatUsd } from "@/lib/pricing";
import { Section } from "@/components/ui/Section";
import { CheckIcon } from "@/components/site/icons";
import { includesFor } from "@/components/site/PackageGrid";

/** Corsa Club: the every-two-weeks plan after a first detail (price and inclusions from business.ts). */
export function CorsaClub({ lang, num }: { lang: Lang; num?: number }) {
  const club = getService("monthly-maintenance");
  if (!club?.plan) return null;
  const d = dict(lang).club;
  const c = includesFor(club, lang);
  return (
    <Section tone="night" id="corsa-club" labelledBy="club-title" className="relative overflow-hidden">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          {num !== undefined && (
            <span className="race-num mb-4" aria-hidden="true">
              {String(num).padStart(2, "0")}
            </span>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-apex">{d.eyebrow}</p>
          <h2 id="club-title" className="mt-2 font-display text-5xl text-balance sm:text-6xl">
            {d.title}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-chalk/80">{d.body}</p>
          <Link
            href={`${isPrelaunch ? "/request" : localePath(lang, "/book")}?service=${club.id}`}
            className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-full bg-apex-deep px-7 font-semibold text-white hover:bg-[#a51824]"
          >
            {isPrelaunch ? "Get launch updates" : d.cta}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="carbon rounded-lg border border-white/10 p-6 sm:p-8">
          <p className="font-display text-6xl leading-none text-apex">{d.price(formatUsd(club.price))}</p>
          <p className="mt-3 font-medium text-chalk/80">{d.cadence}</p>
          <div className="stripe-divider my-6 opacity-70" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-chalk/65">{d.includedTitle}</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {c.items.map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckIcon className="mt-1 shrink-0 text-apex" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
