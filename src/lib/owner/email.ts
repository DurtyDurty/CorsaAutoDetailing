import "server-only";
import { business } from "@/config/business";
import { getEmailAdapter } from "@/lib/email";
import type { LeadStore, OutboundEmailRecord } from "@/lib/leads/types";
import { composeOwnerEmail } from "@/lib/owner-email";

export type SendOwnerEmailResult =
  | { status: "sent"; record: OutboundEmailRecord | null; alreadySent: boolean }
  | { status: "failed"; reason: string }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

/**
 * Email a customer from the business address (Resend), with the owner's
 * signature. Used by the web dashboard and the app, so both behave the same:
 * one send per sendKey, every attempt logged, replies go to the contact inbox.
 */
export async function sendOwnerEmail(
  store: LeadStore,
  leadId: string,
  input: { subject: string; message: string; sendKey: string },
): Promise<SendOwnerEmailResult> {
  const lead = await store.getLead(leadId);
  if (!lead) return { status: "not_found" };

  const previous = await store.findOutboundEmailBySendKey(input.sendKey);
  if (previous) {
    return previous.status === "sent"
      ? { status: "sent", record: previous, alreadySent: true }
      : { status: "failed", reason: previous.error ?? "The earlier attempt with this draft failed. Start a new message." };
  }

  const email = getEmailAdapter();
  if (email.kind === "disabled") return { status: "unavailable", reason: "Email isn't configured on the server (Resend)." };

  const body = composeOwnerEmail(input.message);
  const base = { leadId, sendKey: input.sendKey, toEmail: lead.email, subject: input.subject, body, providerMessageId: null, error: null };
  let record: OutboundEmailRecord | null;
  try {
    const { id } = await email.send({
      to: lead.email,
      subject: input.subject,
      text: body,
      replyTo: business.contact.email ?? undefined,
      idempotencyKey: `owner-email-${input.sendKey}`,
    });
    record = await store.recordOutboundEmail({ ...base, status: "sent", providerMessageId: id });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
    await store.recordOutboundEmail({ ...base, status: "failed", error: reason }).catch(() => null);
    return { status: "failed", reason };
  }
  if (lead.stage === "new") await store.updateLead(leadId, { stage: "contacted" });
  return { status: "sent", record, alreadySent: false };
}