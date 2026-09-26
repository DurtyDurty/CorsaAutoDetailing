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
      <p className="text-xs uppercase tracking-[0.18em] font-semibold text-champagne-deep mb-4">{label}</p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{label} by service and vehicle type</caption>
          <thead>
            <tr className="border-b border-charcoal">
              <th scope="col" className="py-3 pr-4 font-medium text-ink-muted text-sm">
                Service
              </th>
              {priced.map((v) => (
                <th scope="col" key={v.id} className="py-3 px-4 font-medium text-sm">
                  {v.label}
                  <span className="block text-ink-muted font-normal text-xs mt-0.5">{v.examples}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {business.services.map((s) => (
              <tr key={s.id} className="border-b border-line">
                <th scope="row" className="py-5 pr-4 align-top font-normal">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm text-ink-muted mt-1 max-w-xs">{s.tagline}</span>
                  {showLinks && (
                    <Link href={`/request?service=${s.id}`} className="inline-block mt-2 text-sm underline underline-offset-4">
                      Request this service
                    </Link>
                  )}
                </th>
                {priced.map((v) => (
                  <td key={v.id} className="py-5 px-4 align-top font-display text-2xl">
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
          <div key={s.id} className="border border-line bg-white rounded-md p-5">
            <h3 className="font-medium text-lg">{s.name}</h3>
            <p className="text-sm text-ink-muted mt-1">{s.tagline}</p>
            <dl className="mt-4 divide-y divide-line">
              {priced.map((v) => (
                <div key={v.id} className="flex items-baseline justify-between py-2.5 gap-4">
                  <dt className="text-sm">{v.label}</dt>
                  <dd className="font-display text-xl">{formatUsd(s.prices[v.id as keyof typeof s.prices])}</dd>
                </div>
              ))}
            </dl>
            {showLinks && (
              <Link href={`/request?service=${s.id}`} className="inline-block mt-4 text-sm underline underline-offset-4">
                Request this service
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
