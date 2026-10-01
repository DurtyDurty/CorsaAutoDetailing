import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { business } from "@/config/business";
import { getEmailAdapter } from "@/lib/email";
import type { InboundEmailRecord, LeadRecord, LeadStore } from "@/lib/leads/types";

/**
 * Customer replies by email, received through Resend.
 *
 * Emails the business sends carry Reply-To `reply+<leadId>@<INBOUND_REPLY_DOMAIN>`,
 * so a reply lands in the right conversation. Resend posts an `email.received`
 * webhook (signed, Svix format); the body is fetched from Resend's API, stored,
 * and the owner gets a copy by email so nothing is missed.
 *
 * Off until INBOUND_REPLY_DOMAIN is set: replies keep going to the contact address.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Accept webhook timestamps up to 5 minutes away from our clock (replay protection). */
const TOLERANCE_SECONDS = 5 * 60;

export function inboundDomain(): string | null {
  const d = process.env.INBOUND_REPLY_DOMAIN?.trim().toLowerCase();
  return d ? d : null;
}

/** Reply-To for an email to this lead, or null when receiving isn't set up. */
export function replyAddressFor(leadId: string): string | null {
  const domain = inboundDomain();
  return domain ? `reply+${leadId}@${domain}` : null;
}

export function leadIdFromAddresses(addresses: string[]): string | null {
  const domain = inboundDomain();
  if (!domain) return null;
  const re = new RegExp(`^reply\\+(${UUID})@${domain.replace(/\./g, "\\.")}$`, "i");
  for (const a of addresses) {
    const m = re.exec(parseAddress(a).email);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return null;
}

/** "Name <a@b.c>" or "a@b.c" → parts. */
export function parseAddress(raw: string): { email: string; name: string | null } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { email: m[2]!.trim().toLowerCase(), name: m[1]!.trim() || null };
  return { email: raw.trim().toLowerCase(), name: null };
}

/** Verifies a Svix-signed webhook (Resend). `secret` is the `whsec_…` signing secret. */
export function verifyWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest();
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The new part of a reply: drops the quoted history most mail apps append. */
export function visibleReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (l, i) =>
      /^On .+wrote:\s*$/.test(l.trim()) ||
      // Gmail/Apple sometimes wrap "On … wrote:" across two lines.
      (/^On .+/.test(l.trim()) && /wrote:\s*$/.test(lines[i + 1]?.trim() ?? "")) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(l.trim()) ||
      (/^From: .+/.test(l.trim()) && lines.slice(i + 1, i + 4).some((n) => /^(Sent|Date|To|Subject): /.test(n.trim()))) ||
      l.startsWith(">"),
  );
  const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
  return kept || text.trim();
}

interface ReceivedEmail {
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  message_id: string | null;
  created_at: string;
}

async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as ReceivedEmail;
}

/** A UUID derived from the provider's email id, so a retried webhook finds the lead it already created. */
function stableUuid(seed: string): string {
  const h = createHash("sha256").update(`inbound:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function findOrCreateLead(
  store: LeadStore,
  emailId: string,
  from: { email: string; name: string | null },
  toAddresses: string[],
): Promise<LeadRecord> {
  const tagged = leadIdFromAddresses(toAddresses);
  if (tagged) {
    const lead = await store.getLead(tagged);
    if (lead) return lead;
  }
  const [recent] = await store.listLeads({ search: from.email, includeArchived: true, limit: 20 }).then((ls) => ls.filter((l) => l.email.toLowerCase() === from.email));
  if (recent) return recent;
  // Someone new emailed the reply address: start a conversation for them.
  const [first, ...rest] = (from.name ?? from.email.split("@")[0] ?? "Customer").split(/\s+/);
  const { lead } = await store.createLead({
    leadType: "contact",
    businessMode: business.mode,
    idempotencyKey: stableUuid(emailId),
    firstName: first || "Customer",
    lastName: rest.join(" ") || null,
    email: from.email,
    phone: null,
    preferredContact: "email",
    vehicleCategory: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    serviceId: null,
    membershipCadence: null,
    futureInterests: [],
    condition: null,
    conditionFlags: [],
    concerns: null,
    zip: null,
    zipEligibility: null,
    city: null,
    serviceAddress: null,
    locationType: null,
    timeWindows: [],
    preferredDate: null,
    notes: null,
    message: null,
    estimate: null,
    pricingVersion: business.pricingVersion,
    consent: { serviceTextVersion: "email-reply", serviceAcceptedAt: new Date().toISOString(), marketingEmail: false, marketingTextVersion: null, marketingAcceptedAt: null },
    source: { landingPath: "email-reply", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    photoRefs: [],
  });
  return lead;
}

/** Copy to the owner's own inbox, so a reply is never only in the app. */
async function notifyOwner(lead: LeadRecord, rec: InboundEmailRecord) {
  const to = process.env.OWNER_NOTIFY_EMAIL;
  const email = getEmailAdapter();
  if (!to || email.kind === "disabled") return;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  await email
    .send({
      to,
      subject: `[${business.brand.shortName}] Reply from ${name}: ${rec.subject || "(no subject)"}`,
      text: `${name} <${rec.fromEmail}> replied:\n\n${visibleReply(rec.body)}\n\nAnswer it from the Inbox in the Corsa Owner app.`,
      replyTo: rec.fromEmail,
      idempotencyKey: `inbound-copy-${rec.providerEmailId}`,
    })
    .catch((err) => console.error("[inbound] owner copy failed:", err instanceof Error ? err.message : err));
}

export type InboundResult = { status: "stored"; leadId: string } | { status: "duplicate" } | { status: "ignored"; reason: string };

/** Handle one `email.received` event: fetch, file under the right customer, store once, copy the owner. */
export async function handleReceivedEmail(store: LeadStore, emailId: string): Promise<InboundResult> {
  const email = await fetchReceivedEmail(emailId);
  const from = parseAddress(email.from);
  if (!from.email.includes("@")) return { status: "ignored", reason: "No sender address." };
  // Never file the business's own sending address as a customer (e.g. a bounce or auto-reply loop).
  // The owner's personal address is allowed: owner copies never go to the reply domain.
  const sender = process.env.EMAIL_FROM ? parseAddress(process.env.EMAIL_FROM).email : null;
  if (sender && from.email === sender) return { status: "ignored", reason: "Sent from the business address." };

  const lead = await findOrCreateLead(store, emailId, from, email.to ?? []);
  const rec = await store.recordInboundEmail({
    providerEmailId: emailId,
    leadId: lead.id,
    fromEmail: from.email,
    fromName: from.name,
    toEmail: email.to?.[0] ? parseAddress(email.to[0]).email : null,
    subject: (email.subject ?? "").slice(0, 500),
    body: (email.text?.trim() || (email.html ? htmlToText(email.html) : "")).slice(0, 50_000),
    messageId: email.message_id,
    receivedAt: email.created_at,
  });
  if (!rec) return { status: "duplicate" };
  // A new reply brings an archived conversation back to the Inbox.
  if (lead.archivedAt) await store.updateLead(lead.id, { archivedAt: null });
  await notifyOwner(lead, rec);
  return { status: "stored", leadId: lead.id };
}
