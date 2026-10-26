import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { business } from "@/config/business";
import { calendarRequestsEnabled } from "@/lib/booking";
import { storeKind } from "@/lib/leads/store";
import { Container } from "@/components/ui/Section";
import { ShortBookingForm } from "@/components/forms/ShortBookingForm";
import { BOOKING_FORM_ID } from "@/components/site/MobileActionBar";
import { RealResults } from "@/components/site/RealResults";
import { TrustPoints } from "@/components/site/TrustPoints";
import { UnavailableNotice } from "@/components/site/UnavailableNotice";

export const metadata: Metadata = {
  title: "Book a mobile detail",
  description:
    "Book mobile auto detailing in Clay County, St. Johns and Jacksonville, FL. Packages from $90, done at your home or work. Nothing is charged online.",
  alternates: { canonical: "/book" },
  // The ads landing page; /services and the home page are the ones meant for search.
  robots: { index: false, follow: true },
};

/**
 * Where the ads send people (2026-10-25): packages, trust points and the short
 * booking form on one screen. When online requests aren't open (before launch,
 * or with deposits on) the full /request page handles it instead.
 */
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const unavailable = storeKind() === "unavailable";
  if (!unavailable && !calendarRequestsEnabled()) {
    const q = new URLSearchParams();
    if (typeof sp.service === "string") q.set("service", sp.service);
    if (typeof sp.offer === "string") q.set("offer", sp.offer);
    redirect(`/request${q.size ? `?${q}` : ""}`);
  }
  const service = typeof sp.service === "string" ? sp.service : undefined;

  return (
    <>
      <section className="bg-asphalt text-chalk on-dark">
        <Container className="py-7 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-apex">Mobile detailing · {business.serviceAreas.region}</p>
          <h1 className="mt-2 font-display text-[2.6rem] leading-[0.95] sm:text-6xl text-balance">Book a detail at your door</h1>
          <p className="mt-3 max-w-2xl text-chalk/80 sm:text-lg">
            We bring our own water and power to your home or work. Pick a package and a day, and we&rsquo;ll text or call to confirm.
            Nothing is charged online.
          </p>
          <TrustPoints className="mt-4" />
        </Container>
      </section>

      <Container className="py-8 sm:py-12">
        <div id={BOOKING_FORM_ID} className="max-w-3xl scroll-mt-24">
          {unavailable ? (
            <UnavailableNotice />
          ) : (
            <ShortBookingForm initialService={service} firstTimeOffer={sp.offer === "first-time"} />
          )}
        </div>
      </Container>

      <RealResults tone="chalk" />
    </>
  );
}
