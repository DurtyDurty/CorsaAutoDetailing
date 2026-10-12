"use client";

import { useState } from "react";
import { business } from "@/config/business";
import { formatServicePrice, recommendService } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";

/**
 * "Not sure which package?" The customer checks what the car needs and gets one recommended package,
 * which a button puts into the package drop-down. With `name`, the ticked needs are submitted with the form.
 */
export function PackageFinder({
  selected,
  onChoose,
  showPrices = true,
  name,
}: {
  /** Set inside a form that saves the ticked needs with the request; leave unset elsewhere. */
  name?: string;
  /** The package currently in the drop-down. */
  selected: string;
  onChoose: (serviceId: string) => void;
  showPrices?: boolean;
}) {
  const [needs, setNeeds] = useState<string[]>([]);
  const pick = recommendService(needs);

  return (
    <details className="border border-line bg-white rounded-sm px-5 py-4">
      <summary className="cursor-pointer text-sm font-medium">Not sure which package? Check what your car needs</summary>
      <fieldset className="mt-4">
        <legend className="sr-only">What does your car need?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {business.packageNeeds.map((n) => (
            <label key={n.id} className="choice">
              <input
                type="checkbox"
                className="checkbox"
                name={name}
                value={n.id}
                checked={needs.includes(n.id)}
                onChange={() => setNeeds((v) => (v.includes(n.id) ? v.filter((x) => x !== n.id) : [...v, n.id]))}
              />
              <span className="font-medium leading-snug">{n.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 border-t border-line pt-4" aria-live="polite">
        {pick ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep font-semibold">We recommend</p>
              <p className="mt-1 font-medium">
                {pick.service.name}
                {showPrices && ` · from ${formatServicePrice(pick.service)}`}
              </p>
              {pick.followUp && <p className="mt-1 text-sm text-ink-muted">After that, {pick.followUp.name} keeps it fresh.</p>}
            </div>
            {selected === pick.service.id ? (
              <p className="text-sm font-medium text-ink-muted">Selected below</p>
            ) : (
              <Button type="button" size="sm" onClick={() => onChoose(pick.service.id)}>
                Choose this package
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Check anything that applies and we&rsquo;ll suggest a package.</p>
        )}
      </div>
    </details>
  );
}
