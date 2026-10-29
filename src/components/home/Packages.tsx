import { dict, type Lang } from "@/i18n/dictionary";
import { addOnPrice, optionalAddOns } from "@/lib/pricing";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PackageGrid } from "@/components/site/PackageGrid";

export function Packages({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).packages;
  const addOns = optionalAddOns();
  return (
    <Section tone="night" id="packages" labelledBy="packages-title">
      <SectionHeading id="packages-title" num={num} title={d.title} lede={d.lede} onDark />
      <div className="mt-12">
        <PackageGrid lang={lang} />
      </div>
      {addOns.length > 0 && (
        <div className="mt-8 rounded-lg border border-white/10 bg-night-2 p-5 sm:p-6" id="add-ons">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-apex">{d.addOnsTitle}</h3>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {addOns.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-3 shrink-0 -skew-x-[20deg] bg-brand-red" />
                <span>
                  <span className="flex flex-wrap items-baseline gap-x-3 font-semibold">
                    {lang === "es" ? a.es.name : a.name}
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-chalk/65">{addOnPrice(a, lang)}</span>
                  </span>
                  {a.description && <span className="mt-1 block text-sm leading-relaxed text-chalk/75">{lang === "es" ? (a.es.description ?? a.description) : a.description}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-chalk/65">{d.addOnsNote}</p>
        </div>
      )}
    </Section>
  );
}
