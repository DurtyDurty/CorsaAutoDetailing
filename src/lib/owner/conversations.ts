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
import type { LeadRecord, LeadStore, OutboundEmailRecord } from "@/lib/leads/types";
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

function lastActivity(l: LeadRecord, sent: OutboundEmailRecord[]) {
  const latest = sent[0];
  if (latest && latest.createdAt > l.createdAt) {
    return { at: latest.createdAt, preview: `You: ${latest.subject}`, failed: latest.status === "failed" };
  }
  const w = websiteText(l);
  return { at: l.createdAt, preview: w.text.split("\n")[0] || w.title, failed: latest?.status === "failed" };
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
  const sent = await store.listOutboundEmailsForLeads(leads.map((l) => l.id));
  const sentByLead = new Map<string, OutboundEmailRecord[]>();
  for (const e of sent) sentByLead.set(e.leadId, [...(sentByLead.get(e.leadId) ?? []), e]);

  const all = leads
    .map((l): ConversationSummary => {
      const a = lastActivity(l, sentByLead.get(l.id) ?? []);
      return {
        leadId: l.id,
        customerName: name(l),
        email: l.email,
        kind: l.leadType as ConversationKind,
        unread: isUnread(l),
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
  const [sent, appts] = await Promise.all([store.listOutboundEmails(leadId), store.listAppointments({ leadId })]);

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
  ].sort((a, b) => a.at.localeCompare(b.at));

  const serviceId = focus?.serviceId ?? lead.serviceId;
  return {
    leadId: lead.id,
    customerName: name(lead),
    firstName: lead.firstName,
    email: lead.email,
    phone: lead.phone,
    kind: lead.leadType as ConversationKind,
    unread: isUnread(lead),
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

/** "Mark handled": the website message or request no longer needs attention. */
export async function markHandled(store: LeadStore, leadId: string): Promise<void> {
  const lead = await store.getLead(leadId);
  if (!lead) throw new ApiError("not_found", "That conversation doesn't exist.");
  if (lead.stage === "new") await store.updateLead(leadId, { stage: "contacted" });
}
