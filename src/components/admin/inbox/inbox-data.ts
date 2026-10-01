import "server-only";
import { listConversationsQuery } from "@shared/api";
import { availableTemplates } from "@shared/templates";
import type { ConversationDetail } from "@shared/api";
import { business } from "@/config/business";
import type { LeadStore } from "@/lib/leads/types";
import { listConversations } from "@/lib/owner/conversations";
import { formatCents } from "@shared/money";
import { formatEastern } from "@/lib/time";
import type { InboxFilter } from "./ConversationList";
import type { RenderedTemplate } from "./InboxComposer";

export function parseInboxParams(sp: Record<string, string | string[] | undefined>) {
  const filter: InboxFilter = sp.filter === "unread" || sp.filter === "archived" ? sp.filter : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  return { filter, q };
}

export async function loadConversationList(store: LeadStore, filter: InboxFilter, q: string) {
  const query = listConversationsQuery.parse({ filter, q: q || undefined, limit: 100 });
  return (await listConversations(store, query)).items;
}

/** The shared templates, filled in for this customer (server-side, Eastern time). */
export function renderTemplates(c: ConversationDetail): RenderedTemplate[] {
  const fields = {
    firstName: c.firstName,
    businessName: business.brand.name,
    serviceName: c.serviceName,
    date: c.appointment ? formatEastern(c.appointment.startsAt, { dateStyle: "full", timeStyle: undefined }) : null,
    time: c.appointment ? formatEastern(c.appointment.startsAt, { dateStyle: undefined, timeStyle: "short" }) : null,
    balance: c.appointment ? formatCents(c.appointment.balanceDueCents) : null,
  };
  return availableTemplates({ appointment: !!c.appointment, balance: (c.appointment?.balanceDueCents ?? 0) > 0 }).map((t) => ({
    id: t.id,
    label: t.label,
    subject: t.subject(fields),
    body: t.body(fields),
  }));
}