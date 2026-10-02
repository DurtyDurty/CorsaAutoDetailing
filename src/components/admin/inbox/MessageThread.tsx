import type { ConversationMessage } from "@shared/api";
import { formatEastern } from "@/lib/time";
import { cn } from "@/lib/utils";

const stamp = (iso: string) => formatEastern(iso, { dateStyle: "medium", timeStyle: "short" });

/** Website message/request, your emails (right) and customer replies, oldest first. */
export function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => (
        <li key={m.id}>
          {m.type === "website" ? (
            <article className="border border-line bg-white rounded-md px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-ink-muted">
                {m.title} · {stamp(m.at)}
              </p>
              {m.text && <p className="mt-2 text-sm whitespace-pre-line">{m.text}</p>}
            </article>
          ) : m.type === "received" ? (
            <article className="border border-line border-l-[3px] border-l-apex-deep bg-white rounded-md px-4 py-3 mr-8">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-apex-deep">Reply · {stamp(m.at)}</p>
              {m.fromOtherAddress && (
                <p className="mt-1 text-sm text-error">Sent from {m.from}, not the address on file. Check it&rsquo;s really them.</p>
              )}
              {m.subject && <p className="mt-1 font-medium">{m.subject}</p>}
              <p className="mt-1 text-sm whitespace-pre-line">{m.body}</p>
            </article>
          ) : (
            <article className={cn("border rounded-md px-4 py-3 ml-8 bg-chalk-deep", m.status === "failed" ? "border-error" : "border-line")}>
              <p className={cn("text-[0.68rem] uppercase tracking-[0.14em]", m.status === "failed" ? "text-error" : "text-ink-muted")}>
                {m.status === "failed" ? "! Not sent" : "You"} · {stamp(m.at)}
              </p>
              <p className="mt-1 font-medium">{m.subject}</p>
              <p className="mt-1 text-sm whitespace-pre-line">{m.body}</p>
              {m.status === "failed" && m.error && <p className="mt-2 text-sm text-error">{m.error}</p>}
            </article>
          )}
        </li>
      ))}
    </ol>
  );
}