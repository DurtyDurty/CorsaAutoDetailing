import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";

/** "Booking in three steps": a numbered strip that ends on a short checkered band. */
export function BookingSteps({ lang, num }: { lang: Lang; num: number }) {
  const d = dict(lang).steps;
  return (
    <Section tone="night2" id="how-it-works" labelledBy="steps-title">
      <SectionHeading id="steps-title" num={num} title={d.title} onDark />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {d.items.map((s, i) => (
          <li key={s.title} className="relative rounded-lg border border-white/10 bg-night-3 p-6">
            <span className="race-num" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-xl font-semibold">
              <span className="sr-only">{i + 1}. </span>
              {s.title}
            </h3>
            <p className="mt-2 leading-relaxed text-chalk/75">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="checker mt-8 w-28 rounded-sm opacity-80" aria-hidden="true" />
    </Section>
  );
}
