import type { Metadata } from "next";
import { releaseHold, releaseToken } from "@/lib/booking";
import { getLeadStore } from "@/lib/leads/store";
import { Container } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Payment not completed", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The customer backed out of the deposit checkout. Release their hold right
 * away (instead of waiting for it to expire) so they can pick the same time
 * again. The token proves the request comes from the browser that booked.
 */
export default async function BookingCancelledPage({ searchParams }: PageProps<"/booking/cancelled">) {
  const { appointment, t } = await searchParams;
  let serviceId: string | null = null;

  const store = await getLeadStore();
  if (store && typeof appointment === "string" && typeof t === "string") {
    const appt = (await store.listAppointments()).find((a) => a.id === appointment);
    const lead = appt ? await store.getLead(appt.leadId) : null;
    if (appt && lead && releaseToken(appt.id, lead) === t) {
      await releaseHold(appt);
      serviceId = appt.serviceId;
    }
  }
  const retry = `/request${serviceId ? `?service=${serviceId}` : ""}`;

  return (
    <Container className="py-20 max-w-2xl">
      <h1 className="font-display text-4xl sm:text-5xl">Payment not completed.</h1>
      <p className="mt-4 text-lg text-ink-muted leading-relaxed">
        Your appointment wasn&rsquo;t booked and nothing was charged. The time you picked has been released, so you can
        choose it again.
      </p>
      <ButtonLink href={retry} variant="apex" className="mt-8">
        Back to booking
      </ButtonLink>
    </Container>
  );
}
