import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { completeDemoCheckout, demoCheckoutDetails } from "@/lib/payments";
import { formatUsd } from "@/lib/pricing";
import { Container } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Stand-in for Stripe Checkout in development and e2e tests. 404s whenever the
 * demo payment provider isn't active (i.e. always, on a real deployment).
 */
async function payAction(formData: FormData) {
  "use server";
  const id = String(formData.get("session") ?? "");
  const s = await completeDemoCheckout(id);
  if (!s) notFound();
  // successUrl is absolute; keep the redirect on this site either way.
  redirect(new URL(s.successUrl, "http://local").pathname + new URL(s.successUrl, "http://local").search);
}

async function cancelAction(formData: FormData) {
  "use server";
  const s = await demoCheckoutDetails(String(formData.get("session") ?? ""));
  if (!s) notFound();
  redirect(new URL(s.cancelUrl, "http://local").pathname + new URL(s.cancelUrl, "http://local").search);
}

export default async function DemoCheckoutPage({ searchParams }: PageProps<"/booking/demo-checkout">) {
  const { session } = await searchParams;
  const s = typeof session === "string" ? await demoCheckoutDetails(session) : null;
  if (!s) notFound();

  return (
    <Container className="py-20 max-w-md">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep">Test mode · no real charge</p>
      <h1 className="font-display text-4xl mt-3">Test checkout</h1>
      <div className="mt-6 border border-line bg-white p-5">
        <p className="font-medium">{s.description}</p>
        <p className="mt-2 font-display text-4xl">{formatUsd(s.amountCents / 100)}</p>
      </div>
      <form className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="session" value={s.id} />
        <Button type="submit" formAction={payAction} variant="apex" size="lg">
          Pay test deposit
        </Button>
        <Button type="submit" formAction={cancelAction} variant="ghost">
          Cancel and go back
        </Button>
      </form>
    </Container>
  );
}
