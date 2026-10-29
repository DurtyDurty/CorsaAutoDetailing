import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PackageGrid } from "@/components/site/PackageGrid";

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
