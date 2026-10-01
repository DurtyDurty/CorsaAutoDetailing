import { NextResponse } from "next/server";
import { getLeadStore } from "@/lib/leads/store";
import { handleReceivedEmail, verifyWebhook } from "@/lib/inbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend `email.received` webhook: customer replies to reply.corsaautodetailing.com.
 * The Svix signature is checked against the raw body before anything else.
 * Non-2xx makes Resend retry; storage is idempotent on Resend's email id.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Receiving is not configured." }, { status: 503 });

  const raw = await req.text();
  const ok = verifyWebhook(
    raw,
    { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    secret,
  );
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) {
    console.info(`[inbound] ignored event type ${event.type ?? "unknown"}`);
    return NextResponse.json({ ignored: true });
  }

  const store = await getLeadStore();
  if (!store) return NextResponse.json({ error: "Store unavailable." }, { status: 503 });
  try {
    const result = await handleReceivedEmail(store, event.data.email_id);
    // Outcome only (no addresses or content) so delivery problems are visible in the logs.
    console.info(`[inbound] ${result.status}${result.status === "ignored" ? `: ${result.reason}` : ""}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[inbound] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}