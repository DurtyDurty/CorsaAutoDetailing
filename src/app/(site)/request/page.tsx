import type { Metadata } from "next";
import { business, isPrelaunch } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { QuoteRequestForm } from "@/components/forms/QuoteRequestForm";
import { LaunchListForm } from "@/components/forms/LaunchListForm";
import { earliestPreferenceDate } from "@/lib/time";
import { bookingEnabled } from "@/lib/booking";
import { photosEnabled } from "@/lib/photos";
import { storeKind } from "@/lib/leads/store";
import { UnavailableNotice } from "@/components/site/UnavailableNotice";

export const metadata: Metadata = {
  title: isPrelaunch ? "Get launch updates" : "Request an appointment",
  description: isPrelaunch
    ? "Booking opens soon. Leave your email and we'll send updates, including the day booking opens."
    : "Book the Corsa Essential or Signature Detail: tell us about your vehicle, its condition and where it'll be. Final pricing is confirmed at inspection; nothing is charged online.",
  alternates: { canonical: "/request" },
  robots: { index: false, follow: true },
};

/**
 * PRELAUNCH: no booking requests are taken. The page collects launch-list
 * signups instead, pre-filling the package and vehicle size the visitor chose.
 * LIVE: the four-step booking request form.
 */
export default async function RequestPage({ searchParams }: PageProps<"/request">) {
  const sp = await searchParams;
  const service = typeof sp.service === "string" && business.services.some((s) => s.id === sp.service) ? sp.service : undefined;
  const vehicle =
    typeof sp.vehicle === "string" && business.vehicleCategories.some((v) => v.id === sp.vehicle) ? sp.vehicle : undefined;
  const unavailable = storeKind() === "unavailable";
  const serviceName = service ? business.services.find((s) => s.id === service)?.name : undefined;

  if (isPrelaunch) {
    return (
      <>
        <PageHero
          eyebrow="Booking opens soon"
          title="We're not booking yet. Get the first word."
          lede={`Leave your email and we'll send updates${serviceName ? ` on the ${serviceName}` : ""}, including the day booking opens. No appointment is created and nothing is charged.`}
        />
        <Container className="py-12 sm:py-16">
          <div className="max-w-2xl border border-line bg-white rounded-sm p-6 sm:p-8">
            {unavailable ? <UnavailableNotice /> : <LaunchListForm initialService={service} initialVehicle={vehicle} />}
          </div>
        </Container>
      </>
    );
  }

  const booking = bookingEnabled();
  return (
    <>
      <PageHero
        eyebrow={booking ? "Book a detail" : "Request an appointment"}
        title={booking ? "Pick your time. Lock it in." : "Tell us about your car."}
        lede={
          booking
            ? "Four short steps: your vehicle, its condition, where and when, then a small deposit to hold the time. Prices shown are starting estimates; the final price is confirmed at an in-person inspection before any work begins."
            : "Four short steps. Prices shown are starting estimates; the final price is confirmed at an in-person inspection before any work begins. No payment is collected until availability and final pricing are confirmed."
        }
      />
      <Container className="py-12 sm:py-16">
        <div className="max-w-2xl">
          {unavailable ? (
            <UnavailableNotice />
          ) : (
            <QuoteRequestForm
              mode={business.mode}
              earliestDate={earliestPreferenceDate()}
              photosEnabled={photosEnabled()}
              initialService={service}
              initialVehicle={vehicle}
              booking={booking}
            />
          )}
        </div>
      </Container>
    </>
  );
}
