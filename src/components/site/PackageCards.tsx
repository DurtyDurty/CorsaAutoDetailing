"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { business, isPrelaunch, type PricedVehicleId, type ServiceDefinition } from "@/config/business";
import { formatUsd } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Arrow } from "@/components/ui/Button";

const PRICED = business.vehicleCategories.filter((v) => v.priced) as {
  id: PricedVehicleId;
  label: string;
  examples: string;
}[];

function bookHref(serviceId: string, vehicle: PricedVehicleId | null) {
  const q = new URLSearchParams({ service: serviceId });
  if (vehicle) q.set("vehicle", vehicle);
  return `/request?${q.toString()}`;
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className={cn("mt-1 shrink-0", className)}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/**
 * The two detailing packages as side-by-side cards, with an optional vehicle-size
 * picker. The picker highlights the matching price on both cards and passes the
 * size (with the package) into the booking form.
 *
 * `showPrices={false}` (home page) hides the picker and every price, trims the
 * checklist, and links to the services page for pricing instead.
 */
export function PackageCards({
  headingLevel = "h3",
  showPrices = true,
}: {
  headingLevel?: "h2" | "h3";
  showPrices?: boolean;
}) {
  const [vehicle, setVehicle] = useState<PricedVehicleId | null>(null);
  const pickerId = useId();
  const label = business.priceLabel[business.mode];

  return (
    <div>
      {showPrices && (
      <fieldset className="mb-8">
        <legend className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted mb-3">
          Show my price · vehicle size
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="presentation">
          {PRICED.map((v) => {
            const id = `${pickerId}-${v.id}`;
            const checked = vehicle === v.id;
            return (
              <label
                key={v.id}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 border px-4 py-3 transition-colors",
                  checked ? "border-asphalt bg-asphalt text-chalk" : "border-line bg-white hover:border-ink-muted",
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name={`${pickerId}-vehicle`}
                  value={v.id}
                  checked={checked}
                  onChange={() => {
                    setVehicle(v.id);
                    track("pricing_vehicle_selected", { vehicle_category: v.id });
                  }}
                  className="sr-only"
                />
                <span className="text-sm font-semibold">{v.label}</span>
                <span className={cn("text-xs", checked ? "text-chalk/70" : "text-ink-muted")}>{v.examples}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        {business.services.map((s, i) => (
          <PackageCard
            key={s.id}
            service={s}
            index={i}
            vehicle={vehicle}
            priceLabel={label}
            headingLevel={headingLevel}
            showPrices={showPrices}
          />
        ))}
      </div>
    </div>
  );
}

function PackageCard({
  service: s,
  index,
  vehicle,
  priceLabel,
  headingLevel: H,
  showPrices,
}: {
  service: ServiceDefinition;
  index: number;
  vehicle: PricedVehicleId | null;
  priceLabel: string;
  headingLevel: "h2" | "h3";
  showPrices: boolean;
}) {
  const PREVIEW_ITEMS = 6;
  // Full grouped list on the services page; the home/town preview keeps the
  // first PREVIEW_ITEMS items across groups (in order) and counts the rest.
  const total = s.includes.reduce((n, g) => n + g.items.length, 0);
  const limit = showPrices ? total : PREVIEW_ITEMS;
  const groups = s.includes
    .map((g, i) => {
      const before = s.includes.slice(0, i).reduce((n, x) => n + x.items.length, 0);
      return { heading: g.heading, items: g.items.slice(0, Math.max(0, limit - before)) };
    })
    .filter((g) => g.items.length > 0);
  const hiddenCount = total - groups.reduce((n, g) => n + g.items.length, 0);
  const featured = Boolean(s.badge);
  const base = s.includesEverythingIn ? business.services.find((x) => x.id === s.includesEverythingIn) : null;
  const headingId = `pkg-${s.id}`;
  const shortName = s.name.replace(/^Corsa\s+/, "").replace(/\s+Detail$/, "");

  return (
    <article
      id={s.id}
      aria-labelledby={headingId}
      className={cn(
        "group relative flex scroll-mt-28 flex-col bg-white p-6 sm:p-8 transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-1",
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

      <p className={cn("font-mono text-[0.7rem] uppercase tracking-[0.16em]", featured ? "text-apex-deep" : "text-ink-muted")}>
        Package 0{index + 1}
      </p>
      <H id={headingId} className="mt-2 font-display italic font-extrabold text-4xl sm:text-5xl leading-[0.95]">
        {s.name}
      </H>
      <p className="mt-4 text-ink-muted leading-relaxed">{s.description}</p>

      {/* Prices (services page only) */}
      <div className="mt-6">
        {showPrices && (
        <>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-muted">{priceLabel} · starting at</p>
        <dl className="mt-2 divide-y divide-line border-y border-line">
          {PRICED.map((v) => {
            const selected = vehicle === v.id;
            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-baseline justify-between gap-4 px-3 py-2.5 transition-colors",
                  selected && (featured ? "bg-[#fbeceb]" : "bg-chalk"),
                )}
              >
                <dt className={cn("text-sm", selected ? "font-semibold text-ink" : "text-ink-muted")}>
                  {selected && <span className="sr-only">Your vehicle: </span>}
                  {v.label}
                </dt>
                <dd className={cn("font-display text-3xl sm:text-4xl", selected && featured && "text-apex-deep")}>
                  <span className="sr-only">starting at </span>
                  {formatUsd(s.prices[v.id])}
                  <span className="align-top text-base text-ink-muted">+</span>
                </dd>
              </div>
            );
          })}
        </dl>
        </>
        )}
        <p className={cn("flex items-center gap-2 text-sm text-ink-muted", showPrices && "mt-3")}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          Estimated service time: {s.duration}
        </p>
      </div>

      <Link
        href={bookHref(s.id, vehicle)}
        onClick={() => track("book_package_clicked", { service: s.id, vehicle_category: vehicle ?? "none" })}
        className={cn(
          "mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border px-7 py-3.5 text-[0.95rem] font-semibold uppercase tracking-[0.08em] transition-colors",
          featured
            ? "border-apex-deep bg-apex-deep text-white hover:bg-[#a51109] hover:border-[#a51109]"
            : "border-asphalt bg-asphalt text-chalk hover:bg-apex-deep hover:border-apex-deep hover:text-white",
        )}
      >
        {/* Before launch the same link collects an email for updates (the /request page switches forms). */}
        {isPrelaunch ? "Get launch updates" : `Book ${shortName}`}
        <Arrow />
      </Link>
      {!showPrices && (
        <Link
          href={`/services#${s.id}`}
          className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-ink hover:text-apex-deep"
        >
          See pricing &amp; full details
          <Arrow />
        </Link>
      )}

      {/* Included */}
      <div className="mt-8 border-t border-line pt-6">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink">
          {base ? `Everything in the ${base.name.replace(/^Corsa\s+/, "")}, plus:` : "What's included"}
        </p>
        {groups.map((g) => (
          <div key={g.heading} className="mt-5 first:mt-4">
            <h4 className="flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 -skew-x-[20deg]", featured ? "bg-apex-deep" : "bg-asphalt")} />
              {g.heading}
            </h4>
            <ul className="mt-2.5 grid gap-2.5">
              {g.items.map((item) => (
                <li key={item} className="flex gap-3 text-[0.95rem] leading-snug">
                  <Check className={featured ? "text-apex-deep" : "text-ink"} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="mt-3 text-sm text-ink-muted">+ {hiddenCount} more in the full package</p>
        )}
      </div>
    </article>
  );
}
