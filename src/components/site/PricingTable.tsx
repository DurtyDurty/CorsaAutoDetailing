import Link from "next/link";
import { business } from "@/config/business";
import { formatUsd } from "@/lib/pricing";

const priced = business.vehicleCategories.filter((v) => v.priced);

/**
 * Side-by-side comparison on desktop, stacked per-service blocks on mobile.
 * Both renderings come from the same configuration.
 */
export function PricingTable({ showLinks = true }: { showLinks?: boolean }) {
  const label = business.priceLabel[business.mode];
  return (
    <div>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep mb-4">{label}</p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{label} by service and vehicle type</caption>
          <thead>
            <tr className="border-b-2 border-asphalt">
              <th scope="col" className="py-3 pr-4 font-mono font-normal uppercase tracking-[0.14em] text-ink-muted text-xs">
                Service
              </th>
              {priced.map((v) => (
                <th scope="col" key={v.id} className="py-3 px-4 font-semibold text-sm uppercase tracking-[0.06em]">
                  {v.label}
                  <span className="block text-ink-muted font-normal text-xs mt-0.5">{v.examples}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {business.services.map((s) => (
              <tr key={s.id} className="border-b border-line transition-colors hover:bg-white">
                <th scope="row" className="py-5 pr-4 align-top font-normal">
                  <span className="block font-display text-2xl">{s.name}</span>
                  <span className="block text-sm text-ink-muted mt-1 max-w-xs">{s.tagline}</span>
                  {showLinks && (
                    <Link href={`/request?service=${s.id}`} className="inline-flex items-center gap-1.5 mt-3 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-apex-deep hover:underline underline-offset-4">
                      Request this service →
                    </Link>
                  )}
                </th>
                {priced.map((v) => (
                  <td key={v.id} className="py-5 px-4 align-top font-display text-5xl">
                    {formatUsd(s.prices[v.id as keyof typeof s.prices])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked */}
      <div className="md:hidden flex flex-col gap-4">
        {business.services.map((s) => (
          <div key={s.id} className="relative border border-line bg-white rounded-sm p-5 pt-6 overflow-hidden"><span className="absolute inset-x-0 top-0 h-[3px] bg-apex-deep" aria-hidden="true" />
            <h3 className="font-display text-3xl">{s.name}</h3>
            <p className="text-sm text-ink-muted mt-1">{s.tagline}</p>
            <dl className="mt-4 divide-y divide-line">
              {priced.map((v) => (
                <div key={v.id} className="flex items-baseline justify-between py-2.5 gap-4">
                  <dt className="text-sm">{v.label}</dt>
                  <dd className="font-display text-3xl">{formatUsd(s.prices[v.id as keyof typeof s.prices])}</dd>
                </div>
              ))}
            </dl>
            {showLinks && (
              <Link href={`/request?service=${s.id}`} className="inline-flex items-center gap-1.5 mt-4 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-apex-deep hover:underline underline-offset-4">
                Request this service →
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm text-ink-muted max-w-2xl">
        Minivans, oversized trucks, heavily soiled and unusual vehicles are quoted individually. {business.finalQuoteNotice}{" "}
        {business.taxNotice}
      </p>
    </div>
  );
}
