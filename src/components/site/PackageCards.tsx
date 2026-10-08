"use client";

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
 * Detailing packages as cards, in their groups (Popular / Interior / Exterior),
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
                <GroupHeading id={`group-${g.id}`} className="font-display italic font-extrabold text-3xl sm:text-4xl leading-none">
                  {g.title}
                </GroupHeading>
                <p className="mt-1.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-apex-deep">{g.subtitle}</p>
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
  const base = s.includesEverythingIn ? getService(s.includesEverythingIn) : null;
  const sizes = sizePrices(s);
  const headingId = `pkg-${s.id}`;
  const listHeading = base ? `Everything in ${base.name}, plus:` : (s.includesHeading ?? "What's included");

  return (
    <article
      id={s.id}
      aria-labelledby={headingId}
      className={cn(
        "group relative flex scroll-mt-28 flex-col bg-white p-6 sm:p-7 transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-1",
        featured
          ? "border-2 border-apex-deep shadow-[0_24px_60px_-28px_rgba(200,21,11,0.45)] hover:shadow-[0_30px_70px_-28px_rgba(200,21,11,0.6)]"
          : "border border-line hover:shadow-[0_24px_60px_-30px_rgba(12,13,16,0.35)]",
      )}
    >
      {/* Racing stripe: grows on hover */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-0 h-1 transition-[width] duration-500",
          featured ? "w-full bg-apex-deep" : "w-16 bg-asphalt group-hover:w-full",
        )}
      />
      {s.badge && (
        <p className="absolute -top-3.5 right-6 bg-apex-deep px-3 py-1.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-white">
          {s.badge}
        </p>
      )}

      <H id={headingId} className="font-display italic font-extrabold text-3xl sm:text-[2.1rem] leading-[0.95]">
        {s.name}
      </H>
      {s.tagline && (
        <p className={cn("mt-2 font-mono text-[0.72rem] uppercase tracking-[0.16em]", featured ? "text-apex-deep" : "text-ink-muted")}>
          {s.tagline}
        </p>
      )}

      {showPrices && (
        <div className="mt-5 border-y border-line py-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-muted">{priceLabel}</p>
          <p className={cn("mt-1 font-display text-4xl", featured && "text-apex-deep")}>
            <span className="sr-only">starting at </span>
            {formatServicePrice(s)}
            <span className="align-top text-base text-ink-muted">+</span>
          </p>
          {s.billing === "monthly" && <p className="text-sm text-ink-muted">Billed monthly.</p>}
          {sizes && (
            <p className="mt-1 text-sm text-ink-muted">
              {sizes.map((p, i) => (
                <span key={p.size} className="whitespace-nowrap">
                  {i > 0 && " · "}
                  {p.size} {formatUsd(p.price)}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* Included */}
      <div className="mt-6 flex-1">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink">{listHeading}</p>
        <ul className="mt-3 grid gap-2.5">
          {s.includes.map((item) => (
            <li key={item} className="flex gap-3 text-[0.95rem] leading-snug">
              <Check className={featured ? "text-apex-deep" : "text-ink"} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/request?service=${s.id}`}
        onClick={() => track("book_package_clicked", { service: s.id })}
        className={cn(
          "mt-7 inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border px-6 py-3.5 text-[0.95rem] font-semibold uppercase tracking-[0.08em] transition-colors",
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
          className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-ink hover:text-apex-deep"
        >
          See pricing &amp; details
          <Arrow />
        </Link>
      )}
    </article>
  );
}
