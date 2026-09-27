import { business } from "@/config/business";
import { cn } from "@/lib/utils";

/**
 * Owner-supplied pricing, protection and inspection disclosures. Always
 * rendered as plain visible text — never collapsed or animated — so customers
 * see them next to every set of prices.
 */

export function InspectionDisclaimer({ className, id }: { className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={cn("border-l-[3px] border-apex-deep bg-white px-4 py-3.5 text-sm leading-relaxed text-ink", className)}
    >
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-apex-deep">Inspection &amp; final pricing</p>
      <p className="mt-1.5">{business.disclosures.inspection}</p>
    </div>
  );
}

export function PricingDisclosures({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="text-sm leading-relaxed text-ink-muted">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink">Pricing</p>
        <p className="mt-1.5">
          {business.disclosures.pricing} {business.taxNotice}
        </p>
      </div>
      <div className="text-sm leading-relaxed text-ink-muted">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink">Protection</p>
        <p className="mt-1.5">{business.disclosures.protection}</p>
      </div>
      <InspectionDisclaimer className="lg:col-span-2" />
    </div>
  );
}
