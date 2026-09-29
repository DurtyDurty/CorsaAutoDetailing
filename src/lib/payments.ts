import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { storeKind } from "@/lib/leads/store";

/**
 * Deposit payments.
 *
 * - `stripe`: Stripe Checkout (hosted page, so card data never touches this
 *   app). Enabled by STRIPE_SECRET_KEY; webhooks verified with STRIPE_WEBHOOK_SECRET.
 * - `demo`: local simulation for development and e2e tests. Only available when
 *   the demo lead store is active, which is never the case on a real deployment.
 * - `disabled`: online booking is off; the site falls back to request-only.
 *
 * Amounts always come from server configuration, never from the browser.
 */

export interface CheckoutRequest {
  appointmentId: string;
  leadId: string;
  description: string;
  amountCents: number;
  customerEmail: string;
  /** Absolute URL; `session_id={CHECKOUT_SESSION_ID}` is appended. */
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface CheckoutStatus {
  id: string;
  status: "open" | "complete" | "expired";
  paid: boolean;
  paymentIntentId: string | null;
  appointmentId: string | null;
}

export interface PaymentAdapter {
  readonly kind: "stripe" | "demo" | "disabled";
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  getCheckout(sessionId: string): Promise<CheckoutStatus | null>;
  /** Close an unpaid checkout so it can no longer be paid. No-op if already closed. */
  expireCheckout(sessionId: string): Promise<void>;
  refund(paymentIntentId: string, amountCents: number): Promise<void>;
}

/* ---------- Stripe ---------- */

class StripePayments implements PaymentAdapter {
  readonly kind = "stripe" as const;
  constructor(private readonly stripe: Stripe) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sep = req.successUrl.includes("?") ? "&" : "?";
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: req.customerEmail,
        client_reference_id: req.appointmentId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: req.amountCents,
              product_data: {
                name: req.description,
                description: "Holds your appointment. Credited toward your final price.",
              },
            },
          },
        ],
        metadata: { appointment_id: req.appointmentId, lead_id: req.leadId },
        payment_intent_data: {
          description: req.description,
          metadata: { appointment_id: req.appointmentId, lead_id: req.leadId },
        },
        success_url: `${req.successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: req.cancelUrl,
        expires_at: Math.floor(req.expiresAt.getTime() / 1000),
      },
      // One Checkout per held appointment, even if the request is retried.
      { idempotencyKey: `checkout-${req.appointmentId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { id: session.id, url: session.url };
  }

  async getCheckout(sessionId: string): Promise<CheckoutStatus | null> {
    try {
      const s = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        id: s.id,
        status: (s.status ?? "open") as CheckoutStatus["status"],
        paid: s.payment_status === "paid",
        paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
        appointmentId: s.metadata?.appointment_id ?? null,
      };
    } catch {
      return null;
    }
  }

  async expireCheckout(sessionId: string): Promise<void> {
    const s = await this.getCheckout(sessionId);
    if (s?.status === "open") await this.stripe.checkout.sessions.expire(sessionId);
  }

  async refund(paymentIntentId: string, amountCents: number): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId, amount: amountCents },
      { idempotencyKey: `refund-${paymentIntentId}` },
    );
  }
}

/** Verify and parse a Stripe webhook. Throws on a bad signature. */
export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) throw new Error("Stripe webhook is not configured.");
  if (!signature) throw new Error("Missing Stripe-Signature header.");
  return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
}

function stripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/* ---------- Demo (local / e2e only) ---------- */

interface DemoSession extends CheckoutStatus {
  amountCents: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: string;
  refundedCents: number;
}

const demoFile = () => path.join(process.cwd(), ".data", "demo-payments.json");

async function loadDemo(): Promise<Record<string, DemoSession>> {
  try {
    return JSON.parse(await fs.readFile(demoFile(), "utf8")) as Record<string, DemoSession>;
  } catch {
    return {};
  }
}

async function saveDemo(data: Record<string, DemoSession>) {
  await fs.mkdir(path.dirname(demoFile()), { recursive: true });
  const tmp = `${demoFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, demoFile());
}

class DemoPayments implements PaymentAdapter {
  readonly kind = "demo" as const;

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const data = await loadDemo();
    const id = `demo_cs_${randomUUID().replace(/-/g, "")}`;
    const sep = req.successUrl.includes("?") ? "&" : "?";
    data[id] = {
      id,
      status: "open",
      paid: false,
      paymentIntentId: null,
      appointmentId: req.appointmentId,
      amountCents: req.amountCents,
      description: req.description,
      successUrl: `${req.successUrl}${sep}session_id=${id}`,
      cancelUrl: req.cancelUrl,
      expiresAt: req.expiresAt.toISOString(),
      refundedCents: 0,
    };
    await saveDemo(data);
    return { id, url: `/booking/demo-checkout?session=${id}` };
  }

  async getCheckout(sessionId: string): Promise<CheckoutStatus | null> {
    const s = (await loadDemo())[sessionId];
    if (!s) return null;
    const expired = s.status === "open" && Date.parse(s.expiresAt) < Date.now();
    return { id: s.id, status: expired ? "expired" : s.status, paid: s.paid, paymentIntentId: s.paymentIntentId, appointmentId: s.appointmentId };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    const data = await loadDemo();
    if (data[sessionId]?.status === "open") {
      data[sessionId].status = "expired";
      await saveDemo(data);
    }
  }

  async refund(paymentIntentId: string, amountCents: number): Promise<void> {
    const data = await loadDemo();
    const s = Object.values(data).find((x) => x.paymentIntentId === paymentIntentId);
    if (s) {
      s.refundedCents = amountCents;
      await saveDemo(data);
    }
  }
}

/** Demo checkout page helpers. */
export async function demoCheckoutDetails(sessionId: string): Promise<DemoSession | null> {
  if (getPaymentAdapter().kind !== "demo") return null;
  return (await loadDemo())[sessionId] ?? null;
}

export async function completeDemoCheckout(sessionId: string): Promise<DemoSession | null> {
  if (getPaymentAdapter().kind !== "demo") return null;
  const data = await loadDemo();
  const s = data[sessionId];
  if (!s || s.status !== "open" || Date.parse(s.expiresAt) < Date.now()) return null;
  Object.assign(s, { status: "complete", paid: true, paymentIntentId: `demo_pi_${randomUUID().replace(/-/g, "")}` });
  await saveDemo(data);
  return s;
}

/* ---------- selection ---------- */

class DisabledPayments implements PaymentAdapter {
  readonly kind = "disabled" as const;
  async createCheckout(): Promise<CheckoutSession> {
    throw new Error("Payments are not configured.");
  }
  async getCheckout() {
    return null;
  }
  async expireCheckout() {}
  async refund() {
    throw new Error("Payments are not configured.");
  }
}

export function getPaymentAdapter(): PaymentAdapter {
  if (process.env.STRIPE_SECRET_KEY) return new StripePayments(stripeClient());
  if (storeKind() === "demo") return new DemoPayments();
  return new DisabledPayments();
}
