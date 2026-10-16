import { randomUUID } from "node:crypto";
import { QUOTE_STATUS_LABELS, type AppointmentDetail } from "@shared/api";
import { formatCents } from "@shared/money";
import { formatEastern } from "@/lib/time";
import { ConfirmSubmit } from "@/components/admin/work/ConfirmSubmit";
import { QuoteLines } from "@/components/admin/work/QuoteLines";
import { sendQuoteAction } from "@/app/admin/jobs/actions";

const EXPIRY_DAYS = [1, 2, 3, 5, 7];

/** "13:30" → "1:30 PM". */
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const when = (iso: string) => formatEastern(iso, { dateStyle: "medium", timeStyle: "short" });

/**
 * The quote for a held job: where it stands, a link to the PDF, and the form
 * to send (or revise) it. Lines start from the requested package (or the quote
 * being revised) and can be removed, added, or picked from the common extras.
 */
export function QuoteCard({ a, back }: { a: AppointmentDetail; back: string }) {
  const q = a.quote;
  const draft = a.quoteDraft;
  if (!q && !draft) return null;

  const revising = !!q && q.status !== "accepted";
  const waiting = q?.status === "sent";
  const form = draft ? <QuoteForm a={a} back={back} revising={revising} /> : null;

  return (
    <section id="quote" aria-label="Quote" className="border-2 border-asphalt bg-white rounded-md p-5 flex flex-col gap-4 scroll-mt-6">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-muted">Quote</h2>

      {q && (
        <div className={waiting ? "flex flex-col gap-1 text-sm border-l-4 border-[#d9a441] bg-[#fdf6e7] px-4 py-3" : "flex flex-col gap-1 text-sm"}>
          {waiting && <p className="font-display text-xl">✉ Sent. Waiting on the customer</p>}
          <p className="font-medium">
            {QUOTE_STATUS_LABELS[q.status]} · {q.number} · <strong>{formatCents(q.totalCents)}</strong>
          </p>
          <p className="text-ink-muted">
            Sent {when(q.sentAt)} to {a.email}
            {waiting && ` · valid until ${when(q.expiresAt)}`}
            {q.respondedAt && ` · answered ${when(q.respondedAt)}`}
          </p>
          {waiting && <p>When they accept, the job is confirmed and you&apos;ll get an email. Nothing else to do until then.</p>}
          {q.responseNote && q.status === "declined" && <p>Their reason: {q.responseNote}</p>}
          <a href={`/admin/jobs/${a.id}/quote`} target="_blank" rel="noreferrer" className="underline underline-offset-4 w-fit">
            View PDF
          </a>
        </div>
      )}

      {draft && waiting && (
        <details className="border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium w-fit">Change something? Send a revised quote</summary>
          <div className="pt-4">{form}</div>
        </details>
      )}
      {draft && !waiting && form}
    </section>
  );
}

function QuoteForm({ a, back, revising }: { a: AppointmentDetail; back: string; revising: boolean }) {
  const q = a.quote;
  const draft = a.quoteDraft!;
  // Starts from the open quote being revised, or from the requested package.
  const lines = q && revising ? q.lines : draft.lines;
  return (
        <form action={sendQuoteAction} className="flex flex-col gap-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <input type="hidden" name="back" value={back} />
          <p className="text-sm font-medium">{revising ? "Send a revised quote (replaces the one above)" : "Send a quote"}</p>
          {draft.requested && (
            <p className="text-sm border-l-[3px] border-[#d9a441] bg-chalk px-3 py-2">
              Customer asked for: <strong>{draft.requested}</strong>
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm sm:w-64">
            <span className="font-medium">Arrival time (Eastern, same day)</span>
            <select name="arrivalTime" defaultValue={draft.arrivalTime} className="field min-h-10 py-2">
              {draft.arrivalOptions.map((t) => (
                <option key={t} value={t}>
                  {clock(t)}
                </option>
              ))}
            </select>
          </label>
          <QuoteLines initial={lines} extras={draft.extras} initialDiscountCents={revising && q ? q.discountCents : 0} />
          <label className="flex flex-col gap-1 text-sm sm:w-64">
              <span className="font-medium">Customer has to answer within</span>
              <select name="expiresInDays" defaultValue={String(draft.defaultExpiresInDays)} className="field min-h-10 py-2">
                {EXPIRY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} day{d > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">What the car needs &amp; what will be done (the customer sees this at the top of the quote)</span>
            <textarea
              name="notes"
              maxLength={1000}
              rows={5}
              defaultValue={revising ? (q?.notes ?? "") : ""}
              className="field"
              placeholder={"e.g. Heavy pet hair in the back seats and cargo area, light water spots on the glass.\nFull interior vacuum and shampoo, pet-hair removal, hand wash and spot treatment on the windows."}
            />
          </label>
          <p className="text-xs text-ink-muted">
            The customer gets an email with the quote as a PDF and a private link to accept it. Accepting confirms the job. The time stays held until the quote expires (never past the
            appointment).
          </p>
          <div>
            <ConfirmSubmit confirm="Email this quote to the customer?">{revising ? "Send revised quote" : "Send quote"}</ConfirmSubmit>
          </div>
        </form>
  );
}
