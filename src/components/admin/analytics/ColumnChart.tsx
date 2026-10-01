"use client";

import { useState } from "react";
import { compactUsd, fullUsd } from "./format";

export interface Column {
  label: string;
  title: string;
  valueCents: number;
  jobs: number;
  current: boolean;
}

const H = 180; // plot height
const AXIS = 22; // x-axis label band
const LEFT = 54; // y-axis label band
const RIGHT = 18; // room for the last period's label
const BAR_MAX = 24;
const BAR = "#4a4f5a"; // graphite: every period
const ACCENT = "#c8150b"; // Corsa red: the current period only
const GRID = "#e6e6e2";
const BASE = "#c9c9c3";

function niceMax(v: number): number {
  if (v <= 0) return 100_00;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Booked revenue per period: thin columns, recessive grid, the current period in the accent. */
export function ColumnChart({ columns }: { columns: Column[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // A compact plot keeps text legible when the SVG scales down on a phone.
  const width = Math.max(320, columns.length * 28 + LEFT + RIGHT);
  // Many periods: label every other one so labels never collide.
  const every = columns.length > 8 ? 2 : 1;
  const band = (width - LEFT - RIGHT) / columns.length;
  const barW = Math.min(BAR_MAX, band * 0.6);
  const max = niceMax(Math.max(...columns.map((c) => c.valueCents)));
  const ticks = [0, max / 2, max];
  const y = (v: number) => H - (v / max) * H;
  const peak = columns.reduce((best, c, i) => (c.valueCents > (columns[best]?.valueCents ?? -1) ? i : best), 0);
  const h = hover !== null ? columns[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${H + AXIS + 18}`} className="w-full h-auto" role="img" aria-label="Booked revenue by period. Values are in the table below.">
        <g transform="translate(0,18)">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRID} strokeWidth={1} />
              <text x={LEFT - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="#6b6e75" style={{ fontVariantNumeric: "tabular-nums" }}>
                {compactUsd(t)}
              </text>
            </g>
          ))}
          {columns.map((c, i) => {
            const x = LEFT + i * band + (band - barW) / 2;
            const top = y(c.valueCents);
            const bh = H - top;
            const r = Math.min(4, bh);
            // Selective labels: the current period and the best one; hidden while a tooltip is open.
            const labelled = hover === null && c.valueCents > 0 && (c.current || i === peak);
            return (
              <g key={c.title}>
                {bh > 0 && (
                  <path
                    d={`M${x},${H} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${H} Z`}
                    fill={c.current ? ACCENT : BAR}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {labelled && (
                  <text x={x + barW / 2} y={top - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0c0d10">
                    {compactUsd(c.valueCents)}
                  </text>
                )}
                {(i % every === (columns.length - 1) % every || c.current) && (
                  <text x={LEFT + i * band + band / 2} y={H + 16} textAnchor="middle" fontSize={12} fill="#6b6e75">
                    {c.label}
                  </text>
                )}
                {/* Hit target: the whole band, not just the painted column. */}
                <rect
                  x={LEFT + i * band}
                  y={-18}
                  width={band}
                  height={H + 18}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${c.title}: ${fullUsd(c.valueCents)} booked, ${c.jobs} ${c.jobs === 1 ? "job" : "jobs"}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none focus-visible:stroke-ink focus-visible:[stroke-width:1]"
                />
              </g>
            );
          })}
        </g>
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-sm border border-line bg-white px-3 py-2 text-xs shadow-sm"
          style={{ left: `${((LEFT + hover * band + band / 2) / width) * 100}%`, transform: "translateX(-50%)" }}
          role="status"
        >
          <p className="text-sm font-semibold">{fullUsd(h.valueCents)}</p>
          <p className="text-ink-muted whitespace-nowrap">
            {h.title} · {h.jobs} {h.jobs === 1 ? "job" : "jobs"}
          </p>
        </div>
      )}
    </div>
  );
}