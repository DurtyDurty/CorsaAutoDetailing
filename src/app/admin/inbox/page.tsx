import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { ConversationList } from "@/components/admin/inbox/ConversationList";
import { loadConversationList, parseInboxParams } from "@/components/admin/inbox/inbox-data";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const { filter, q } = parseInboxParams(sp);
  const items = await loadConversationList(store, filter, q);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl">Inbox</h1>
        {typeof sp.ok === "string" && (
          <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
            {sp.ok}.
          </p>
        )}
        <ConversationList items={items} filter={filter} q={q} />
      </div>
      <div className="hidden lg:flex items-center justify-center border border-dashed border-line rounded-md text-sm text-ink-muted min-h-64">
        Choose a conversation to read it and reply.
      </div>
    </div>
  );
}