"use client";

import { useState } from "react";
import Link from "next/link";
import { business, getService, isPrelaunch } from "@/config/business";
import { formatServicePrice, formatUsd, sizePrices } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import { Arrow } from "@/components/ui/Button";
import { Field } from "@/components/forms/primitives";
import { ServiceSelect } from "@/components/forms/ServiceSelect";
import { cn } from "@/lib/utils";

/**
 * Instant quote: pick a package from the drop-down and see its starting price
 * right away, then continue to /request with the package pre-selected.
 */
export function InstantQuote({ className }: { className?: string }) {
  const [serviceId, setServiceId] = useState("");
  const service = getService(serviceId);
  const sizes = service ? sizePrices(service) : null;

  return (
    <div className={cn("border border-line bg-white rounded-sm p-6 sm:p-8", className)}>
      <Field name="quoteService" label="Service">
        {(p) => (
          <ServiceSelect
            name="quoteService"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              if (e.target.value) track("pricing_vehicle_selected", { service: e.target.value });
            }}
            {...p}
          />
        )}
      </Field>

      <div className="mt-6 border-t border-line pt-6" aria-live="polite">
        {service ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep font-semibold">
                {isPrelaunch ? "Planned starting price" : "Starting price"}
              </p>
              <p className="mt-1 font-display text-5xl">
                {formatServicePrice(service)}
                <span className="align-top text-xl text-ink-muted">+</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {service.name}
                {service.billing === "monthly" && " · billed monthly"}
              </p>
              {sizes && <p className="mt-1 text-sm text-ink-muted">{sizes.map((p) => `${p.size} ${formatUsd(p.price)}`).join(" · ")}</p>}
            </div>
            <Link
              href={`/request?service=${service.id}`}
              onClick={() => track("book_package_clicked", { service: service.id })}
              className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border border-apex-deep bg-apex-deep px-7 py-3.5 text-[0.95rem] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#a51109] hover:border-[#a51109]"
            >
              {/* Before launch the same link collects an email for updates (the /request page switches forms). */}
              {isPrelaunch ? "Get launch updates" : "Book this detail"}
              <Arrow />
            </Link>
          </div>
        ) : (
          <p className="text-ink-muted">Choose a service to see its starting price.</p>
        )}
        <p className="mt-4 text-xs text-ink-muted">
          Starting price for a vehicle in average condition. {business.finalQuoteNotice} {business.taxNotice}
        </p>
      </div>
    </div>
  );
}
