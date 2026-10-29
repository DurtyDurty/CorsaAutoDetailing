import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PackageGrid } from "@/components/site/PackageGrid";

/** The package cards. Add-ons are picked in the booking form and listed on /services (owner, 2026-10-28). */
export function Packages({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).packages;
  return (
    <Section tone="night" id="packages" labelledBy="packages-title">
      <SectionHeading id="packages-title" num={num} title={d.title} lede={d.lede} onDark />
      <div className="mt-12">
        <PackageGrid lang={lang} />
      </div>
    </Section>
  );
}
