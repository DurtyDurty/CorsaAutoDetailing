import "server-only";
import { getService } from "@/config/business";
import type {
  ConversationDetail,
  ConversationKind,
  ConversationMessage,
  ConversationSummary,
  ListConversationsQuery,
  Page,
} from "@shared/api";
import { FIELD_STATUSES, isBlocking } from "@shared/appointment-status";
import { ApiError } from "@/lib/api/http";
import { getEmailAdapter } from "@/lib/email";
import { conditionFlagLabel } from "@/lib/pricing";
import { visibleReply } from "@/lib/inbound";
import type { InboundEmailRecord, LeadRecord, LeadStore, OutboundEmailRecord } from "@/lib/leads/types";
import { defaultEmailSubject, ownerSignature } from "@/lib/owner-email";
import { summarize } from "./appointments";

const name = (l: LeadRecord) => [l.firstName, l.lastName].filter(Boolean).join(" ");

/** Website messages and booking requests count as unread until someone acts on them. */
const isUnread = (l: LeadRecord) => l.stage === "new" && (l.leadType === "contact" || l.leadType === "quote_request");

function websiteText(l: LeadRecord): { title: string; text: string } {
  const service = l.serviceId ? (getService(l.serviceId)?.name ?? l.estimate?.serviceName ?? l.serviceId) : null;
  switch (l.leadType) {
    case "contact":
      return { title: "Website message", text: l.message ?? "" };
    case "quote_request": {
      const vehicle = [l.vehicleYear, l.vehicleMake, l.vehicleModel].filter(Boolean).join(" ");
      const lines = [
        service && `Service: ${service}`,
        vehicle && `Vehicle: ${vehicle}`,
        l.serviceAddress && `Address: ${[l.serviceAddress, l.city, l.zip].filter(Boolean).join(", ")}`,
        l.preferredDate && `Preferred date: ${l.preferredDate}`,
        l.conditionFlags.length > 0 && `Noted: ${l.conditionFlags.map(conditionFlagLabel).join(", ")}`,
        l.concerns && `Concerns: ${l.concerns}`,
        l.notes && `About the space: ${l.notes}`,
      ].filter(Boolean);
      return { title: "Booking request", text: lines.join("\n") };
    }
    case "launch_list":
      return { title: "Joined the launch list", text: service ? `Interested in: ${service}` : "" };
    default:
      return { title: "Maintenance plan interest", text: l.notes ?? "" };
  }
}

function lastActivity(l: LeadRecord, sent: OutboundEmailRecord[], received: InboundEmailRecord[]) {
  const latestSent = sent[0];
  const latestReceived = received[0];
  const failed = latestSent?.status === "failed";
  if (latestReceived && latestReceived.receivedAt >= l.createdAt && (!latestSent || latestReceived.receivedAt >= latestSent.createdAt)) {
    const text = visibleReply(latestReceived.body).split("\n")[0];
    return { at: latestReceived.receivedAt, preview: text || latestReceived.subject, failed };
  }
  if (latestSent && latestSent.createdAt > l.createdAt) {
    return { at: latestSent.createdAt, preview: `You: ${latestSent.subject}`, failed };
  }
  const w = websiteText(l);
  return { at: l.createdAt, preview: w.text.split("\n")[0] || w.title, failed };
}

function group<T extends { leadId: string | null }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) if (r.leadId) m.set(r.leadId, [...(m.get(r.leadId) ?? []), r]);
  return m;
}

/** Cursor = `<lastActivityAt>|<leadId>` of the last item returned. */
function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  if (!at || !id || Number.isNaN(Date.parse(at))) throw new ApiError("invalid", "That page link has expired.");
  return { at, id };
}

export async function listConversations(store: LeadStore, q: ListConversationsQuery): Promise<Page<ConversationSummary>> {
  const after = decodeCursor(q.cursor);
  const leads = (await store.listLeads({ search: q.q, limit: 500 })).filter((l) => l.stage !== "spam");
  const ids = leads.map((l) => l.id);
  const [sent, received] = await Promise.all([store.listOutboundEmailsForLeads(ids), store.listInboundEmailsForLeads(ids)]);
  const sentByLead = group(sent);
  const receivedByLead = group(received);

  const all = leads
    .map((l): ConversationSummary => {
      const replies = receivedByLead.get(l.id) ?? [];
      const a = lastActivity(l, sentByLead.get(l.id) ?? [], replies);
      return {
        leadId: l.id,
        customerName: name(l),
        email: l.email,
        kind: l.leadType as ConversationKind,
        unread: isUnread(l) || replies.some((r) => !r.readAt),
        lastActivityAt: a.at,
        preview: a.preview.slice(0, 160),
        lastSendFailed: a.failed,
      };
    })
    .filter((c) => q.filter === "all" || c.unread)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || b.leadId.localeCompare(a.leadId))
    .filter((c) => !after || c.lastActivityAt < after.at || (c.lastActivityAt === after.at && c.leadId < after.id));

  const items = all.slice(0, q.limit);
  const last = items.at(-1);
  return { items, nextCursor: all.length > q.limit && last ? `${last.lastActivityAt}|${last.leadId}` : null };
}

export async function getConversation(store: LeadStore, leadId: string): Promise<ConversationDetail> {
  const lead = await store.getLead(leadId);
  if (!lead) throw new ApiError("not_found", "That conversation doesn't exist.");
  const [sent, appts, received] = await Promise.all([
    store.listOutboundEmails(leadId),
    store.listAppointments({ leadId }),
    store.listInboundEmailsForLeads([leadId]),
  ]);

  // Prefer a job underway, then the next booked one, then the most recent.
  const nowIso = new Date().toISOString();
  const ranked = [
    ...appts.filter((a) => FIELD_STATUSES.includes(a.status)),
    ...appts.filter((a) => isBlocking(a.status) && a.endsAt >= nowIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    ...[...appts].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  ];
  const [focus] = ranked.length ? await summarize(store, [ranked[0]!]) : [];

  const w = websiteText(lead);
  const messages: ConversationMessage[] = [
    { id: `lead-${lead.id}`, type: "website" as const, at: lead.createdAt, title: w.title, text: w.text },
    ...sent.map((e) => ({
      id: e.id,
      type: "sent" as const,
      at: e.createdAt,
      subject: e.subject,
      body: e.body,
      status: e.status,
      error: e.error,
    })),
    ...received.map((r) => ({
      id: r.id,
      type: "received" as const,
      at: r.receivedAt,
      from: r.fromName ? `${r.fromName} <${r.fromEmail}>` : r.fromEmail,
      subject: r.subject,
      body: visibleReply(r.body),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const serviceId = focus?.serviceId ?? lead.serviceId;
  return {
    leadId: lead.id,
    customerName: name(lead),
    firstName: lead.firstName,
    email: lead.email,
    phone: lead.phone,
    kind: lead.leadType as ConversationKind,
    unread: isUnread(lead) || received.some((r) => !r.readAt),
    serviceName: serviceId ? (getService(serviceId)?.name ?? null) : null,
    appointment: focus
      ? { id: focus.id, startsAt: focus.startsAt, endsAt: focus.endsAt, balanceDueCents: focus.balance.balanceDueCents }
      : null,
    defaultSubject: defaultEmailSubject(lead),
    signature: ownerSignature(),
    canSend: getEmailAdapter().kind !== "disabled",
    messages,
  };
}

/** "Mark handled": the website message or request, and any replies, no longer need attention. */
export async function markHandled(store: LeadStore, leadId: string): Promise<void> {
  const lead = await store.getLead(leadId);
  if (!lead) throw new ApiError("not_found", "That conversation doesn't exist.");
  if (lead.stage === "new") await store.updateLead(leadId, { stage: "contacted" });
  await store.markInboundRead(leadId);
}

/** Opening a conversation reads its replies. */
export async function markRepliesRead(store: LeadStore, leadId: string): Promise<void> {
  await store.markInboundRead(leadId);
}
