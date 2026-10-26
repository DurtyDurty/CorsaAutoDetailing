import { getService } from "@/config/business";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";

/** "Start with Signature, keep it fresh monthly": the recommended customer journey. */
export function CareJourney() {
  const [signature, monthly] = [getService("platinum-full"), getService("monthly-maintenance")];
  const steps = [
    { name: signature?.name, when: "First visit", what: "A full reset, inside and out." },
    { name: monthly?.name, when: "Every month", what: "One exterior and one interior wash a month, plus priority booking." },
  ];
  return (
    <section className="bg-asphalt text-chalk on-dark" aria-labelledby="care-journey">
      <Container className="py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 id="care-journey" className="font-display text-5xl sm:text-6xl text-balance">
              Start with Signature. Keep it fresh monthly.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-chalk/80">
              For the best results, begin with the Signature Full Detail to bring your vehicle back. Keep those results
              with Monthly Maintenance: a wash inside and out every month, priority booking and 15% off add-ons.
            </p>
            <ButtonLink href="/book?service=monthly-maintenance" variant="apex" size="lg" className="mt-9">
              Start Monthly Maintenance
              <Arrow />
            </ButtonLink>
          </div>
          <ol className="grid gap-4">
            {steps.map((s, i) => (
              <li key={s.when} className="flex gap-5 rounded-lg border border-line-dark bg-asphalt-soft p-6 sm:p-7">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-apex-deep text-base font-semibold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-apex">{s.when}</p>
                  <p className="mt-1.5 font-display text-3xl">{s.name}</p>
                  <p className="mt-1.5 text-chalk/70">{s.what}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
