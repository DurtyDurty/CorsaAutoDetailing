"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface BarRow {
  label: string;
  value: number;
  /** Shown at the bar tip, e.g. "4" or "4 · $1,196". */
  display: string;
  /** Extra detail for hover/focus, e.g. "50% of requests". */
  detail?: string;
}

const BAR = "#4a4f5a";

/** One series as horizontal bars: label, thin bar growing from the left, value at the tip. */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li
          key={r.label}
          tabIndex={0}
          aria-label={`${r.label}: ${r.display}${r.detail ? `, ${r.detail}` : ""}`}
          onPointerEnter={() => setHover(r.label)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(r.label)}
          onBlur={() => setHover(null)}
          className="grid grid-cols-[minmax(7rem,12rem)_1fr] items-center gap-3 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ink"
        >
          <span className="text-sm truncate" title={r.label}>
            {r.label}
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={cn("h-3.5 rounded-r-[4px] transition-opacity", hover && hover !== r.label && "opacity-55")}
              style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%`, background: BAR, maxWidth: "calc(100% - 4.5rem)" }}
              aria-hidden="true"
            />
            <span className="text-sm whitespace-nowrap [font-variant-numeric:tabular-nums]">{r.display}</span>
            {hover === r.label && r.detail && <span className="text-xs text-ink-muted whitespace-nowrap">{r.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}