import { business } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Flag } from "@/components/site/VeteranBadge";

/** Four reasons, each numbered like a car on the grid. Every claim here is owner-confirmed (2026-10-28). */
export function WhyCorsa({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).why;
  const { tiles } = d;
  const items = [
    { key: "local", title: tiles.local.title, body: tiles.local.body },
    { key: "bilingual", title: tiles.bilingual.title, body: tiles.bilingual.body, lang: "es" },
    { key: "contained", title: tiles.contained.title, body: tiles.contained.body },
    ...(business.owner.veteranOwned
      ? [{ key: "veteran", title: tiles.veteran.title, body: tiles.veteran.body(business.militaryDiscount.percent), flag: true }]
      : []),
  ];
  return (
    <Section tone="night2" id="why-corsa" labelledBy="why-title">
      <SectionHeading id="why-title" num={num} title={d.title} lede={d.lede} onDark />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t, i) => (
          <li key={t.key} className="relative flex flex-col rounded-lg border border-white/10 bg-night-3 p-6">
            <span className="font-display text-5xl italic leading-none text-chalk/45" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 flex items-center gap-2.5 text-xl font-semibold" lang={"lang" in t ? t.lang : undefined}>
              {"flag" in t && t.flag && <Flag className="h-3.5 w-[27px] shrink-0 rounded-[1px]" />}
              {t.title}
            </h3>
            <p className="mt-2 leading-relaxed text-chalk/75">{t.body}</p>
            <span className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-brand-red" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
