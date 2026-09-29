import { NextResponse, type NextRequest } from "next/server";
import { confirmBookingFromCheckout, releaseHoldForCheckout } from "@/lib/booking";
import { verifyStripeWebhook } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. The signature is verified against the raw body before
 * anything else happens. Handlers are idempotent: Stripe may deliver the same
 * event more than once, and the return page may confirm the booking first.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let event;
  try {
    event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
  } catch (err) {
    console.error("[stripe] webhook rejected:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await confirmBookingFromCheckout(event.data.object.id);
        break;
      case "checkout.session.expired":
        await releaseHoldForCheckout(event.data.object.id);
        break;
      default:
        break;
    }
  } catch (err) {
    // 500 makes Stripe retry later; the handlers are safe to re-run.
    console.error(`[stripe] ${event.type} failed:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
