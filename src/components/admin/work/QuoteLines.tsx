"use client";

import { useState } from "react";
import { ON_SITE_PRICE, QUOTE_MAX_LINES } from "@shared/api";
import { formatCents } from "@shared/money";

type Line = { key: number; label: string; amount: string };
type Extra = { label: string; minCents: number; maxCents: number };

const dollars = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const toCents = (s: string) => {
  const t = s.replace(/[$,\s]/g, "");
  const n = t === "" ? 0 : Math.round(Number(t) * 100);
  return Number.isFinite(n) ? n : 0;
};
let seq = 0;
const line = (label: string, cents: number): Line => ({ key: seq++, label, amount: cents ? dollars(cents) : "" });

/**
 * The quote's lines, like the app's quote sheet: remove any line, add a blank
 * one, or tap an extra to add it, with the total kept up to date. Posts
 * `rows` plus `custom_i`/`label_i`/`amount_i` for each line (blank ones are dropped)
 * and `discount`.
 */
export function QuoteLines({ initial, extras, initialDiscountCents }: { initial: { label: string; amountCents: number }[]; extras: Extra[]; initialDiscountCents: number }) {
  const [lines, setLines] = useState<Line[]>(() => initial.map((l) => line(l.label, l.amountCents)));
  const [discount, setDiscount] = useState(initialDiscountCents ? dollars(initialDiscountCents) : "");

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const unused = extras.filter((x) => !lines.some((l) => l.label === x.label));
  const room = lines.length < QUOTE_MAX_LINES;
  const subtotal = lines.reduce((s, l) => s + (l.label.trim() ? toCents(l.amount) : 0), 0);
  const total = subtotal - toCents(discount);
  const onSite = lines.filter((l) => l.label.trim() && toCents(l.amount) === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="rows" value={lines.length} />
      <div className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <div key={l.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
            <input type="hidden" name={`custom_${i}`} value="1" />
            <input
              name={`label_${i}`}
              value={l.label}
              onChange={(e) => update(l.key, { label: e.target.value })}
              maxLength={80}
              placeholder="Description, e.g. Ceramic spray coat"
              aria-label={`Line ${i + 1} description`}
              className="field min-h-10 py-2"
            />
            <input
              name={`amount_${i}`}
              value={l.amount}
              onChange={(e) => update(l.key, { amount: e.target.value })}
              inputMode="decimal"
              placeholder="On site"
              aria-label={`Line ${i + 1} amount ($)`}
              className="field min-h-10 py-2 text-right"
            />
            <button
              type="button"
              onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
              aria-label={`Remove line ${i + 1}${l.label ? ` (${l.label})` : ""}`}
              className="w-10 h-10 rounded-sm border border-line text-ink-muted hover:border-error hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
        {lines.length === 0 && <p className="text-sm text-ink-muted">No lines yet. Add one below.</p>}
      </div>

      {room && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setLines((ls) => [...ls, line("", 0)])} className="rounded-sm border border-asphalt px-3 py-1.5 text-sm font-medium">
            + Add a line
          </button>
          {unused.map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setLines((ls) => [...ls, line(x.label, x.minCents)])}
              className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-asphalt hover:text-ink"
            >
              + {x.label} ({x.minCents === x.maxCents ? formatCents(x.minCents) : `${formatCents(x.minCents)}–${formatCents(x.maxCents)}`})
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Discount ($)</span>
          <input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="field min-h-10 py-2" />
        </label>
        <p className="flex items-center justify-between bg-asphalt text-chalk border-l-4 border-apex px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa0ab]">Total</span>
          <span className="font-display text-2xl tabular-nums">{formatCents(Math.max(0, total))}</span>
        </p>
      </div>
      <p className="text-xs text-ink-muted">
        Haven&apos;t seen the car? Leave a line&apos;s $ blank: the customer sees &ldquo;{ON_SITE_PRICE}&rdquo; and it isn&apos;t in the total. Add the real price after the
        inspection with Change total.
        {onSite > 0 && ` ${onSite} ${onSite === 1 ? "line is" : "lines are"} priced on site right now.`}
      </p>
    </div>
  );
}
