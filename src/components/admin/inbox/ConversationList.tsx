import Link from "next/link";
import type { ConversationSummary } from "@shared/api";
import { formatEastern, todayEastern } from "@/lib/time";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ConversationSummary["kind"], string> = {
  contact: "Message",
  quote_request: "Request",
  launch_list: "Launch list",
  membership_interest: "Plan interest",
};

function when(iso: string): string {
  return todayEastern(new Date(iso)) === todayEastern()
    ? formatEastern(iso, { dateStyle: undefined, timeStyle: "short" })
    : formatEastern(iso, { dateStyle: "medium", timeStyle: undefined });
}

export type InboxFilter = "all" | "unread" | "archived";

export function inboxHref(opts: { leadId?: string; filter: InboxFilter; q: string }): string {
  const params = new URLSearchParams();
  if (opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.q) params.set("q", opts.q);
  const qs = params.size ? `?${params}` : "";
  return opts.leadId ? `/admin/inbox/${opts.leadId}${qs}` : `/admin/inbox${qs}`;
}

/** Search, filter tabs and the conversation list. Server-rendered; works without JavaScript. */
export function ConversationList({
  items,
  activeId,
  filter,
  q,
}: {
  items: ConversationSummary[];
  activeId?: string;
  filter: InboxFilter;
  q: string;
}) {
  const tabs: { value: InboxFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "archived", label: "Archived" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <form action="/admin/inbox" className="flex gap-2" role="search">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input name="q" defaultValue={q} placeholder="Search name, email, vehicle…" aria-label="Search conversations" className="field flex-1 min-w-0" />
        <button type="submit" className="border border-line bg-white rounded-sm px-3 text-sm">
          Search
        </button>
      </form>
      <nav aria-label="Show" className="grid grid-cols-3 border border-line rounded-sm bg-white p-0.5 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={inboxHref({ filter: t.value, q })}
            aria-current={filter === t.value ? "page" : undefined}
            className={cn("text-center py-1.5 rounded-sm", filter === t.value ? "bg-asphalt text-chalk" : "text-ink-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted border border-line bg-white rounded-md px-4 py-6 text-center">
          {q ? "No matches." : filter === "unread" ? "All caught up." : filter === "archived" ? "Nothing archived." : "No conversations yet."}
        </p>
      ) : (
        <ul className="border border-line bg-white rounded-md divide-y divide-line overflow-hidden">
          {items.map((c) => (
            <li key={c.leadId}>
              <Link
                href={inboxHref({ leadId: c.leadId, filter, q })}
                aria-current={activeId === c.leadId ? "true" : undefined}
                className={cn("flex gap-3 px-4 py-3 hover:bg-chalk", activeId === c.leadId && "bg-chalk")}
              >
                <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", c.unread ? "bg-apex-deep" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-3">
                    <span className={cn("truncate", c.unread ? "font-semibold" : "")}>
                      {c.unread && <span className="sr-only">Unread. </span>}
                      {c.customerName}
                    </span>
                    <span className="text-xs text-ink-muted shrink-0">{when(c.lastActivityAt)}</span>
                  </span>
                  <span className={cn("block text-[0.68rem] uppercase tracking-[0.14em] mt-0.5", c.unread ? "text-apex-deep" : "text-ink-muted")}>
                    {KIND_LABEL[c.kind]}
                    {c.lastSendFailed ? " · ! Not sent" : c.replied ? " · ✓ Replied" : ""}
                  </span>
                  <span className="block text-sm text-ink-muted truncate">{c.preview}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}