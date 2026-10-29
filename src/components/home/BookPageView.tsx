import { redirect } from "next/navigation";
import { dict, type Lang } from "@/i18n/dictionary";
import { calendarRequestsEnabled } from "@/lib/booking";
import { storeKind } from "@/lib/leads/store";
import { Container } from "@/components/ui/Section";
import { TrustPoints } from "@/components/site/TrustPoints";
import { BookingSection } from "./BookingSection";
import { WhyCorsa } from "./WhyCorsa";
import { FaqSection } from "./FaqSection";

/**
 * /book and /es/book, where the ads send people: a short title, the trust points, then the booking form,
 * the four reasons and the FAQ. When online requests aren't open (before launch, or with deposits on) the
 * full /request page handles it instead.
 */
export async function BookPageView({ lang, searchParams }: { lang: Lang; searchParams: Record<string, string | string[] | undefined> }) {
  const unavailable = storeKind() === "unavailable";
  if (!unavailable && !calendarRequestsEnabled()) {
    const q = new URLSearchParams();
    if (typeof searchParams.service === "string") q.set("service", searchParams.service);
    if (typeof searchParams.offer === "string") q.set("offer", searchParams.offer);
    redirect(`/request${q.size ? `?${q}` : ""}`);
  }
  const d = dict(lang).book;
  const service = typeof searchParams.service === "string" ? searchParams.service : undefined;
  return (
    <div lang={lang}>
      <section className="carbon text-chalk on-dark">
        <Container className="py-7 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-apex">{dict(lang).hero.eyebrow}</p>
          <h1 className="mt-2 font-display text-[2.6rem] leading-[0.95] text-balance sm:text-6xl">{d.pageTitle}</h1>
          <p className="mt-3 max-w-2xl text-chalk/80 sm:text-lg">{d.pageLede}</p>
          <TrustPoints lang={lang} className="mt-4" />
        </Container>
      </section>
      <BookingSection lang={lang} heading={false} initialService={service} firstTimeOffer={searchParams.offer === "first-time"} />
      <WhyCorsa lang={lang} num={1} />
      <FaqSection lang={lang} num={2} />
    </div>
  );
}
