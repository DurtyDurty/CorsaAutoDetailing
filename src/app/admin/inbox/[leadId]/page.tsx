import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { ApiError } from "@/lib/api/http";
import { getConversation, markRepliesRead } from "@/lib/owner/conversations";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ConversationList, inboxHref } from "@/components/admin/inbox/ConversationList";
import { DeleteConversationForm } from "@/components/admin/inbox/DeleteConversationForm";
import { InboxComposer } from "@/components/admin/inbox/InboxComposer";
import { MessageThread } from "@/components/admin/inbox/MessageThread";
import { loadConversationList, parseInboxParams, renderTemplates } from "@/components/admin/inbox/inbox-data";
import { archiveAction, markHandledAction } from "../actions";

export const metadata: Metadata = { title: "Inbox" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConversationPage({ params, searchParams }: PageProps<"/admin/inbox/[leadId]">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const { leadId } = await params;
  if (!UUID.test(leadId)) notFound();
  const sp = await searchParams;
  const { filter, q } = parseInboxParams(sp);

  let c;
  try {
    c = await getConversation(store, leadId);
  } catch (err) {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  }
  // Opening the conversation reads its replies (same as the app).
  if (c.messages.some((m) => m.type === "received")) await markRepliesRead(store, leadId);
  const items = await loadConversationList(store, filter, q);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="hidden lg:flex flex-col gap-4">
        <h1 className="font-display text-3xl">Inbox</h1>
        <ConversationList items={items} activeId={leadId} filter={filter} q={q} />
      </div>

      <section className="flex flex-col gap-4 min-w-0" aria-labelledby="conversation-title">
        <Link href={inboxHref({ filter, q })} className="lg:hidden text-sm underline underline-offset-4">
          ← Inbox
        </Link>
        <header className="border border-line bg-white rounded-md p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="conversation-title" className="font-display text-2xl">
                {c.customerName}
              </h2>
              <p className="text-sm text-ink-muted break-all">
                <a href={`mailto:${c.email}`} className="underline underline-offset-4">
                  {c.email}
                </a>
                {c.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${c.phone}`} className="underline underline-offset-4">
                      {formatPhone(c.phone)}
                    </a>
                  </>
                )}
                {c.archived && <span className="ml-2 text-xs uppercase tracking-[0.14em]">Archived</span>}
              </p>
            </div>
            <Link href={`/admin/leads/${c.leadId}`} className="text-sm underline underline-offset-4 shrink-0">
              Full record &amp; appointments
            </Link>
          </div>
          {typeof sp.error === "string" && (
            <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
              {sp.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {c.unread && (
              <form action={markHandledAction}>
                <input type="hidden" name="leadId" value={c.leadId} />
                <Button type="submit" variant="secondary" size="sm">
                  Mark handled
                </Button>
              </form>
            )}
            <form action={archiveAction}>
              <input type="hidden" name="leadId" value={c.leadId} />
              <input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
              <Button type="submit" variant="secondary" size="sm">
                {c.archived ? "Restore to Inbox" : "Archive"}
              </Button>
            </form>
            <DeleteConversationForm leadId={c.leadId} name={c.customerName} disabled={!c.canDelete} />
          </div>
          {!c.canDelete && (
            <p className="text-xs text-ink-muted">This customer has an upcoming appointment, so they can&rsquo;t be deleted. You can still archive.</p>
          )}
        </header>

        <MessageThread messages={c.messages} />

        <InboxComposer
          key={c.leadId}
          leadId={c.leadId}
          firstName={c.firstName}
          to={c.email}
          defaultSubject={c.defaultSubject}
          signature={c.signature}
          templates={renderTemplates(c)}
          canSend={c.canSend}
          initialSendKey={randomUUID()}
        />
      </section>
    </div>
  );
}