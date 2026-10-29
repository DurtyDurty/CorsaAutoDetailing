import { homeFaq } from "@/content/home-faq";
import { dict, type Lang } from "@/i18n/dictionary";
import { Section, SectionHeading } from "@/components/ui/Section";

/** FAQ accordion (native <details>, no JS) with matching FAQPage structured data. */
export function FaqSection({ lang, num }: { lang: Lang; num: number }) {
  const items = homeFaq(lang);
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <Section tone="night2" id="faq" labelledBy="faq-title">
      <script
        type="application/ld+json"
        // Static, server-generated content from configuration, no user input. "<" is escaped anyway.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading id="faq-title" num={num} title={dict(lang).faq.title} onDark />
        <div className="divide-y divide-white/10 border-y-2 border-brand-red/70">
          {items.map((f) => (
            <details key={f.q} className="group" lang={f.lang}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold hover:text-apex [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="flex-none text-apex transition-transform group-open:rotate-45">
                  <path d="M9 3v12M3 9h12" />
                </svg>
              </summary>
              <p className="max-w-2xl pb-5 leading-relaxed text-chalk/75">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
