import Link from "next/link";
import { business } from "@/config/business";
import { dict, localePath, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";

/** Rough positions on the schematic map (not to scale): west of the river is Clay County, east is St. Johns. */
const PINS: Record<string, [number, number]> = {
  jacksonville: [214, 16],
  "orange-park": [152, 40],
  "fleming-island": [168, 80],
  middleburg: [62, 104],
  "green-cove-springs": [172, 132],
  "st-johns": [252, 70],
  orangedale: [214, 166],
  "world-golf-village": [282, 196],
};

/** A map-style card (decorative) beside the town list, which links to the existing town pages. */
export function ServiceArea({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).area;
  const towns = business.serviceAreas.communities;
  const core = towns.filter((c) => c.coverage === "core");
  const confirm = towns.filter((c) => c.coverage === "confirm");
  const item = (c: (typeof towns)[number]) =>
    c.page ? (
      <Link href={localePath(lang, `/service-areas/${c.slug}`)} className="group flex min-h-11 items-center justify-between gap-3 py-2 font-medium hover:text-apex">
        <span>
          {c.name}
          <span className="sr-only"> ({d.townLink(c.name)})</span>
        </span>
        <span aria-hidden="true" className="text-chalk/40 transition-transform group-hover:translate-x-1 group-hover:text-apex">
          →
        </span>
      </Link>
    ) : (
      <span className="flex min-h-11 items-center py-2 font-medium">{c.name}</span>
    );

  return (
    <Section tone="night" id="service-area" labelledBy="area-title">
      <SectionHeading id="area-title" num={num} title={d.title} lede={d.lede} onDark />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="carbon relative overflow-hidden rounded-lg border border-white/10 p-4" aria-hidden="true">
          <svg viewBox="0 0 320 220" className="h-auto w-full" role="presentation">
            {/* The St. Johns River, roughly: Clay County to its west, St. Johns County to its east. */}
            <path d="M232 0 C 210 40, 200 70, 205 100 S 190 160, 225 220" fill="none" stroke="rgb(120 160 200 / 0.35)" strokeWidth="14" strokeLinecap="round" />
            <path d="M152 40 L168 80 L172 132 L62 104 Z" fill="rgb(229 36 53 / 0.08)" stroke="rgb(229 36 53 / 0.5)" strokeWidth="1.5" strokeDasharray="4 4" />
            {towns.map((c) => {
              const p = PINS[c.slug];
              if (!p) return null;
              const coreTown = c.coverage === "core";
              return (
                <g key={c.slug}>
                  <circle cx={p[0]} cy={p[1]} r={coreTown ? 5 : 4} fill={coreTown ? "#e52435" : "transparent"} stroke={coreTown ? "#f3f3f1" : "#f3f3f1aa"} strokeWidth="1.5" />
                  <text
                    x={p[0] > 240 ? p[0] - 9 : p[0] + 9}
                    y={p[1] + 4}
                    textAnchor={p[0] > 240 ? "end" : "start"}
                    fontSize="10.5"
                    fill={coreTown ? "#f3f3f1" : "#f3f3f1aa"}
                    fontFamily="var(--font-body), sans-serif"
                  >
                    {c.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-apex">{d.core}</h3>
            <ul className="mt-2 divide-y divide-white/10 border-y border-white/10">
              {core.map((c) => (
                <li key={c.slug}>{item(c)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-chalk/65">{d.confirm}</h3>
            <ul className="mt-2 divide-y divide-white/10 border-y border-white/10">
              {confirm.map((c) => (
                <li key={c.slug}>{item(c)}</li>
              ))}
            </ul>
            {lang === "en" && (
              <Link href="/service-areas" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-apex hover:underline">
                {d.allAreas} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
