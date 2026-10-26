"use client";

import { Fragment } from "react";
import Link from "next/link";
import { business, getService, isPrelaunch, type PackageGroupId, type ServiceDefinition } from "@/config/business";
import { formatServicePrice, formatUsd, sizePrices } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Arrow } from "@/components/ui/Button";

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className={cn("mt-1 shrink-0", className)}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/**
 * Detailing packages as cards, in their groups (one group today),
 * each with one starting price and a link into the request form.
 *
 * `groups` limits which groups render (home page shows only "popular").
 * `showPrices={false}` hides every price and links to the services page instead.
 */
export function PackageCards({
  headingLevel = "h3",
  showPrices = true,
  groups,
}: {
  headingLevel?: "h2" | "h3";
  showPrices?: boolean;
  groups?: PackageGroupId[];
}) {
  const label = isPrelaunch ? "Planned starting price" : "Starting at";
  const shown = business.packageGroups.filter((g) => !groups || groups.includes(g.id));
  const GroupHeading = headingLevel;
  const CardHeading = headingLevel === "h2" ? "h3" : "h4";
  const showGroupHeadings = shown.length > 1;

  return (
    <div className="flex flex-col gap-16">
      {shown.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={showGroupHeadings ? `group-${g.id}` : undefined} className="scroll-mt-28">
          {showGroupHeadings && (
            <div className="mb-8 flex items-center gap-5">
              <div className="shrink-0">
                <GroupHeading id={`group-${g.id}`} className="font-display text-3xl sm:text-4xl leading-none">
                  {g.title}
                </GroupHeading>
                <p className="mt-1.5 text-sm font-medium text-apex-deep">{g.subtitle}</p>
              </div>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
            {business.services
              .filter((s) => s.group === g.id)
              .map((s) => (
                <PackageCard key={s.id} service={s} priceLabel={label} headingLevel={CardHeading} showPrices={showPrices} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PackageCard({
  service: s,
  priceLabel,
  headingLevel: H,
  showPrices,
}: {
  service: ServiceDefinition;
  priceLabel: string;
  headingLevel: "h3" | "h4";
  showPrices: boolean;
}) {
  const featured = Boolean(s.badge);
  // The monthly plan spans the full row under the per-visit packages.
  const wide = s.billing === "monthly";
  const base = s.includesEverythingIn ? getService(s.includesEverythingIn) : null;
  const sizes = sizePrices(s);
  const headingId = `pkg-${s.id}`;
  const listHeading = base ? `Everything in ${base.name}, plus:` : (s.includesHeading ?? "What's included");

  return (
    <article
      id={s.id}
      aria-labelledby={headingId}
      className={cn(
        "relative flex scroll-mt-28 flex-col rounded-lg bg-white p-6 sm:p-7 transition-shadow duration-300",
        featured
          ? "border-2 border-apex-deep shadow-[0_24px_60px_-28px_rgba(200,21,11,0.45)]"
          : "border border-line hover:shadow-[0_24px_60px_-30px_rgba(12,13,16,0.3)]",
        wide &&
          "md:col-span-2 lg:col-span-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-12",
      )}
    >
      {s.badge && (
        <p className="absolute -top-3 right-6 rounded-sm bg-apex-deep px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {s.badge}
        </p>
      )}

      <div>
        <H id={headingId} className="font-display text-3xl sm:text-[2.1rem] leading-[0.95]">
          {s.name}
        </H>
        {s.tagline && (
          <p className={cn("mt-2 text-sm font-medium", featured ? "text-apex-deep" : "text-ink-muted")}>{s.tagline}</p>
        )}

        {showPrices && (
          <div className={cn("mt-5 border-y border-line py-3", wide && "lg:border-0 lg:py-0")}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{priceLabel}</p>
            <p className={cn("mt-1 font-display text-4xl", featured && "text-apex-deep")}>
              <span className="sr-only">starting at </span>
              {formatServicePrice(s)}
              <span className="align-top text-base text-ink-muted">+</span>
            </p>
            {s.billing === "monthly" && <p className="text-sm text-ink-muted">Billed monthly.</p>}
            {sizes && (
              <p className="mt-1 text-sm text-ink-muted">
                {sizes.map((p, i) => (
                  // The separator sits outside the no-wrap span so the line can break between sizes.
                  <Fragment key={p.size}>
                    {i > 0 && " · "}
                    <span className="whitespace-nowrap">
                      {p.size} {formatUsd(p.price)}
                    </span>
                  </Fragment>
                ))}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Included */}
      <div className={cn("mt-6 flex-1", wide && "lg:mt-0")}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink">{listHeading}</p>
        <ul className={cn("mt-3 grid gap-2.5", wide && "lg:grid-cols-2 lg:gap-x-8")}>
          {s.includes.map((item) => (
            <li key={item} className="flex gap-3 text-[0.95rem] leading-snug">
              <Check className={featured ? "text-apex-deep" : "text-ink"} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn("mt-7 flex flex-col", wide && "lg:mt-0 lg:min-w-52")}>
        <Link
          href={`${isPrelaunch ? "/request" : "/book"}?service=${s.id}`}
          onClick={() => track("book_package_clicked", { service: s.id })}
          className={cn(
            "group inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border px-6 py-3.5 text-base font-semibold transition-colors",
            featured
              ? "border-apex-deep bg-apex-deep text-white hover:bg-[#a51109] hover:border-[#a51109]"
              : "border-asphalt bg-asphalt text-chalk hover:bg-apex-deep hover:border-apex-deep hover:text-white",
          )}
        >
          {/* Before launch the same link collects an email for updates (the /request page switches forms). */}
          {isPrelaunch ? "Get launch updates" : "Book now"}
          <Arrow />
        </Link>
        {!showPrices && (
          <Link
            href={`/services#${s.id}`}
            className="group mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:text-apex-deep"
          >
            See pricing &amp; details
            <Arrow />
          </Link>
        )}
      </div>
    </article>
  );
}
