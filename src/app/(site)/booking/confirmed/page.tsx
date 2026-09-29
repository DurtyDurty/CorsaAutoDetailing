import type { Metadata } from "next";
import Link from "next/link";
import { business, getService, getVehicleCategory } from "@/config/business";
import { confirmBookingFromCheckout } from "@/lib/booking";
import { formatUsd } from "@/lib/pricing";
import { formatEastern } from "@/lib/time";
import { shortRef } from "@/lib/utils";
import { Container } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { InspectionDisclaimer } from "@/components/site/Disclosures";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Stripe (or the demo checkout) returns here with ?session_id=. Confirming here
 * as well as in the webhook means the customer sees their booking immediately
 * even if the webhook is delayed; the confirmation itself is idempotent.
 */
export default async function BookingConfirmedPage({ searchParams }: PageProps<"/booking/confirmed">) {
  const { session_id: sessionId } = await searchParams;
  const result = typeof sessionId === "string" ? await confirmBookingFromCheckout(sessionId) : { state: "unknown" as const };

  if (result.state === "pending") {
    return (
      <Container className="py-20 max-w-2xl">
        <meta httpEquiv="refresh" content="4" />
        <h1 className="font-display text-4xl">Confirming your payment…</h1>
        <p className="mt-4 text-ink-muted">This usually takes a few seconds. The page will refresh on its own.</p>
      </Container>
    );
  }

  if (result.state === "conflict_refunded") {
    return (
      <Container className="py-20 max-w-2xl">
        <h1 className="font-display text-4xl">That time was taken while you were paying.</h1>
        <p className="mt-4 text-lg text-ink-muted leading-relaxed">
          Your deposit has been refunded in full. Please pick another time; we&rsquo;re sorry for the trouble.
        </p>
        <ButtonLink href="/request" className="mt-8" variant="apex">
          Choose another time
        </ButtonLink>
      </Container>
    );
  }

  if (result.state !== "confirmed") {
    return (
      <Container className="py-20 max-w-2xl">
        <h1 className="font-display text-4xl">We couldn&rsquo;t confirm that booking.</h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          {result.state === "expired"
            ? "The payment window closed before the deposit was paid, so the time wasn't reserved."
            : "If you just paid and landed here, please contact us and we'll sort it out right away."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/request" variant="apex">
            Book again
          </ButtonLink>
          <ButtonLink href="/contact">Contact us</ButtonLink>
        </div>
      </Container>
    );
  }

  const { appointment: appt, lead } = result;
  const service = getService(appt.serviceId ?? "");
  const vehicle = getVehicleCategory(lead.vehicleCategory ?? "");
  const deposit = (appt.depositCents ?? 0) / 100;
  const estimate = lead.estimate?.total ?? null;

  return (
    <Container className="py-16 sm:py-20 max-w-2xl">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Reference {shortRef(lead.id)}</p>
      <h1 className="font-display italic font-extrabold text-5xl sm:text-6xl mt-3">You&rsquo;re booked.</h1>
      <p className="mt-4 text-lg text-ink-muted">A confirmation is on its way to {lead.email}.</p>

      <dl className="mt-8 divide-y divide-line border-y-2 border-asphalt bg-white">
        {[
          ["When", `${formatEastern(appt.startsAt, { dateStyle: "full", timeStyle: "short" })} ET`],
          ["Package", service?.name ?? appt.serviceId],
          ["Vehicle", [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") + (vehicle ? ` (${vehicle.label})` : "")],
          ["Where", [lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ")],
          ["Deposit paid", `${formatUsd(deposit)}, credited toward your final price`],
          ...(estimate !== null ? [["Estimated balance", `${formatUsd(Math.max(0, estimate - deposit))} due when the service is complete`]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-6">
            <dt className="w-40 shrink-0 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <InspectionDisclaimer className="mt-6" />

      <div className="mt-6 text-sm text-ink-muted">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink">Deposit policy</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {business.booking.policy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Need to reschedule or cancel?{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Send us a message
        </Link>
        {business.contact.email ? ` or email ${business.contact.email}` : ""}. Please include reference {shortRef(lead.id)}.
      </p>
    </Container>
  );
}
