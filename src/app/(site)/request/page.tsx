import type { Metadata } from "next";
import { business, isPrelaunch } from "@/config/business";
import { Container } from "@/components/ui/Section";
import { PageHero } from "@/components/site/PageHero";
import { QuoteRequestForm } from "@/components/forms/QuoteRequestForm";
import { earliestPreferenceDate } from "@/lib/time";
import { photosEnabled } from "@/lib/photos";
import { storeKind } from "@/lib/leads/store";
import { UnavailableNotice } from "@/components/site/UnavailableNotice";

export const metadata: Metadata = {
  title: isPrelaunch ? "Request a quote" : "Request an appointment",
  description:
    "Tell us about your vehicle, its condition, and where it'll be. We reply with a firm quote. Requests are reviewed before anything is scheduled.",
  alternates: { canonical: "/request" },
  robots: { index: false, follow: true },
};

export default async function RequestPage({ searchParams }: PageProps<"/request">) {
  const sp = await searchParams;
  const service = typeof sp.service === "string" && business.services.some((s) => s.id === sp.service) ? sp.service : undefined;
  const vehicle =
    typeof sp.vehicle === "string" && business.vehicleCategories.some((v) => v.id === sp.vehicle) ? sp.vehicle : undefined;
  const unavailable = storeKind() === "unavailable";

  return (
    <>
      <PageHero
        eyebrow={isPrelaunch ? "Request a quote" : "Request an appointment"}
        title={isPrelaunch ? "Tell us about your car. We'll quote it when we open." : "Tell us about your car."}
        lede="Four short steps. Pricing shown here is an estimate, not a final invoice; we confirm the quote after reviewing your vehicle and location."
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
            />
          )}
        </div>
      </Container>
    </>
  );
}
