import { Fragment } from "react";
import Link from "next/link";
import { business, getService, isPrelaunch, type ServiceDefinition } from "@/config/business";
import { dict, localePath, type Lang } from "@/i18n/dictionary";
import { formatUsd, sizePrices } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./icons";

const SIZES_ES: Record<string, string> = { Sedan: "Sedán", "SUV/Minivan": "SUV/Minivan", Truck: "Camioneta" };

/** The one-time packages, in config order. Corsa Club (a plan) has its own section. */
export function onePackages(): ServiceDefinition[] {
  return business.services.filter((s) => !s.plan);
}

/** What a package includes, in the page's language. */
export function includesFor(s: ServiceDefinition, lang: Lang) {
  const es = lang === "es";
  return {
    tagline: es ? s.es.tagline : s.tagline,
    heading: s.includesEverythingIn
      ? dict(lang).packages.everythingIn(getService(s.includesEverythingIn)?.name ?? "")
      : ((es ? s.es.includesHeading : s.includesHeading) ?? dict(lang).packages.included),
    items: es ? s.es.includes : s.includes,
    summary: (es ? s.es.summary : s.summary) ?? (es ? s.es.includes : s.includes),
  };
}

/**
 * One card per package: starting price, prices by size, the short list, and the full "what's included" list in
 * a disclosure (still in the page for search engines). Names, prices and inclusions come from business.ts.
 */
export function PackageGrid({ lang, headingLevel: H = "h3" }: { lang: Lang; headingLevel?: "h2" | "h3" }) {
  const d = dict(lang).packages;
  return (
    <ul className="grid gap-5 md:grid-cols-3 md:items-start">
      {onePackages().map((s) => {
        const c = includesFor(s, lang);
        const sizes = sizePrices(s);
        const featured = Boolean(s.badge);
        return (
          <li
            key={s.id}
            id={s.id}
            className={cn(
              "relative flex min-w-0 scroll-mt-24 flex-col rounded-lg bg-night-3 p-6",
              featured ? "border-2 border-apex-deep shadow-[0_24px_60px_-30px_rgba(229,36,53,0.6)]" : "border border-white/10",
            )}
          >
            {s.badge && (
              <p className="absolute -top-3 right-5 rounded-full bg-apex-deep px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                {d.popular}
              </p>
            )}
            <H className="font-display text-3xl leading-[0.95]">{s.name}</H>
            {c.tagline && <p className={cn("mt-1.5 text-sm font-medium", featured ? "text-apex" : "text-chalk/65")}>{c.tagline}</p>}
            <div className="mt-5 border-y border-white/10 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-chalk/65">
                {isPrelaunch ? `${business.priceLabel.PRELAUNCH}` : d.startingAt}
              </p>
              <p className={cn("mt-1 font-display text-5xl leading-none", featured && "text-apex")}>
                {formatUsd(s.price)}
                <span className="align-top text-lg text-chalk/60">+</span>
              </p>
              {sizes && (
                <p className="mt-2 text-sm text-chalk/70">
                  {sizes.map((p, i) => (
                    // The separator sits outside the no-wrap span so the line can break between sizes.
                    <Fragment key={p.size}>
                      {i > 0 && " · "}
                      <span className="whitespace-nowrap">
                        {lang === "es" ? (SIZES_ES[p.size] ?? p.size) : p.size} {formatUsd(p.price)}
                      </span>
                    </Fragment>
                  ))}
                </p>
              )}
            </div>
            <ul className="mt-5 space-y-2">
              {c.summary.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-2.5 text-[0.95rem] leading-snug">
                  <CheckIcon className={cn("mt-0.5 shrink-0", featured ? "text-apex" : "text-chalk/70")} />
                  {item}
                </li>
              ))}
            </ul>
            {c.items.length > Math.min(c.summary.length, 4) || c.items.some((x, i) => x !== c.summary[i]) ? (
            <details className="group mt-4 rounded-md border border-white/10 bg-night-2 px-4 py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {d.seeAll}
                <span aria-hidden="true" className="text-apex transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-chalk/65">{c.heading}</p>
              <ul className="mb-3 mt-2 space-y-1.5 text-sm text-chalk/85">
                {c.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-1 w-2.5 shrink-0 -skew-x-[20deg] bg-brand-red" />
                    {item}
                  </li>
                ))}
              </ul>
            </details>
            ) : null}
            <Link
              href={`${isPrelaunch ? "/request" : localePath(lang, "/book")}?service=${s.id}`}
              className={cn(
                "mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold",
                featured ? "bg-apex-deep text-white hover:bg-[#a51824]" : "border border-chalk/35 text-chalk hover:border-chalk",
              )}
            >
              {isPrelaunch ? "Get launch updates" : d.book}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
