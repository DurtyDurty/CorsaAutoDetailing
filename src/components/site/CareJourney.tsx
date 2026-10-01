import { getService } from "@/config/business";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Container, Eyebrow } from "@/components/ui/Section";

/** "Start With Signature. Keep It Fresh Monthly." — recommended customer journey. */
export function CareJourney() {
  const [signature, monthly] = [getService("platinum-full"), getService("monthly-maintenance")];
  const steps = [
    { n: "01", name: signature?.name, when: "First visit", what: "A full reset, inside and out." },
    { n: "02", name: monthly?.name, when: "Every month", what: "One exterior and one interior wash a month, plus priority booking." },
  ];
  return (
    <section className="relative overflow-hidden bg-asphalt text-chalk on-dark" aria-labelledby="care-journey">
      <div className="grid-lines absolute inset-0" aria-hidden="true" />
      <Container className="relative py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <Eyebrow onDark>Your Corsa care plan</Eyebrow>
            <h2 id="care-journey" className="mt-5 font-display italic font-extrabold text-5xl sm:text-6xl text-balance">
              Start With Signature. Keep It Fresh Monthly.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-chalk/80">
              For the best results, begin with the Signature Full Detail to bring your vehicle back. Keep those results
              with Monthly Maintenance: a wash inside and out every month, priority booking and 15% off add-ons.
            </p>
            <ButtonLink href="/request?service=monthly-maintenance" variant="apex" size="lg" className="mt-9">
              Start Monthly Maintenance
              <Arrow />
            </ButtonLink>
          </div>
          <ol className="grid gap-px border border-line-dark bg-line-dark">
            {steps.map((s) => (
              <li key={s.n} className="group relative bg-asphalt p-6 sm:p-7">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-50 bg-apex transition-transform duration-500 group-hover:scale-y-100"
                />
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-apex">
                  Step {s.n} · {s.when}
                </p>
                <p className="mt-2 font-display text-3xl">{s.name}</p>
                <p className="mt-1.5 text-chalk/70">{s.what}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
