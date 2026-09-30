"use client";

import { useState } from "react";
import Link from "next/link";
import { business, isPrelaunch } from "@/config/business";
import { computeEstimate, formatUsd } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import { Arrow } from "@/components/ui/Button";
import { Field, Select } from "@/components/forms/primitives";
import { cn } from "@/lib/utils";

/**
 * Instant quote: pick a package and vehicle size from drop-downs and see the
 * starting price right away. Uses the same computeEstimate as the booking form,
 * so the number always matches, and hands both choices to /request.
 */
export function InstantQuote({ className }: { className?: string }) {
  const [serviceId, setServiceId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const estimate = serviceId && vehicle ? computeEstimate({ serviceId, vehicleCategoryId: vehicle }) : null;
  const service = business.services.find((s) => s.id === serviceId);

  function onChange(nextService: string, nextVehicle: string) {
    setServiceId(nextService);
    setVehicle(nextVehicle);
    if (nextService && nextVehicle) {
      track("pricing_vehicle_selected", { service: nextService, vehicle_category: nextVehicle });
    }
  }

  const href = `/request?${new URLSearchParams({ service: serviceId, vehicle }).toString()}`;

  return (
    <div className={cn("border border-line bg-white rounded-sm p-6 sm:p-8", className)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="quoteService" label="Service">
          {(p) => (
            <Select name="quoteService" value={serviceId} onChange={(e) => onChange(e.target.value, vehicle)} {...p}>
              <option value="">Choose a package</option>
              {business.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.badge ? `${s.name} (${s.badge})` : s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="quoteVehicle" label="Vehicle size">
          {(p) => (
            <Select name="quoteVehicle" value={vehicle} onChange={(e) => onChange(serviceId, e.target.value)} {...p}>
              <option value="">Choose a size</option>
              {business.vehicleCategories.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-6 border-t border-line pt-6" aria-live="polite">
        {estimate ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep font-semibold">
                {isPrelaunch ? "Your planned starting price" : "Your starting price"}
              </p>
              <p className="mt-1 font-display text-5xl">
                {estimate.total !== null ? formatUsd(estimate.total) : "Custom quote"}
                {estimate.total !== null && <span className="align-top text-xl text-ink-muted">+</span>}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {estimate.serviceName} · {estimate.vehicleCategoryLabel}
                {service && <> · about {service.duration}</>}
              </p>
            </div>
            <Link
              href={href}
              onClick={() => track("book_package_clicked", { service: serviceId, vehicle_category: vehicle })}
              className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border border-apex-deep bg-apex-deep px-7 py-3.5 text-[0.95rem] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#a51109] hover:border-[#a51109]"
            >
              {/* Before launch the same link collects an email for updates (the /request page switches forms). */}
              {isPrelaunch ? "Get launch updates" : "Book this detail"}
              <Arrow />
            </Link>
          </div>
        ) : (
          <p className="text-ink-muted">Choose a service and vehicle size to see your price.</p>
        )}
        <p className="mt-4 text-xs text-ink-muted">
          Starting price for a vehicle in average condition. {business.finalQuoteNotice} {business.taxNotice}
        </p>
      </div>
    </div>
  );
}
