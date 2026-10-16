import { randomUUID } from "node:crypto";
import { QUOTE_STATUS_LABELS, type AppointmentDetail } from "@shared/api";
import { formatCents } from "@shared/money";
import { formatEastern } from "@/lib/time";
import { ConfirmSubmit } from "@/components/admin/work/ConfirmSubmit";
import { sendQuoteAction } from "@/app/admin/jobs/actions";

/** How many blank rows the form offers for custom lines. */
export const QUOTE_BLANK_ROWS = 3;
const EXPIRY_DAYS = [1, 2, 3, 5, 7];

/** "13:30" → "1:30 PM". */
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dollars = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const when = (iso: string) => formatEastern(iso, { dateStyle: "medium", timeStyle: "short" });

type Row = { label: string; cents: number; on: boolean; fixed: boolean; hint: string | null };

/**
 * The quote for a website request: where it stands, a link to the PDF, and the
 * form to send (or revise) it. Rows: the requested package (and any earlier
 * quote's lines), common extras to tick, and blank rows for anything else.
 */
export function QuoteCard({ a, back }: { a: AppointmentDetail; back: string }) {
  const q = a.quote;
  const draft = a.quoteDraft;
  if (!q && !draft) return null;

  const revising = !!q && q.status !== "accepted";
  const waiting = q?.status === "sent";
  const baseLines = q && revising ? q.lines : (draft?.lines ?? []);
  const extras = (draft?.extras ?? []).filter((x) => !baseLines.some((l) => l.label === x.label));
  const rows: Row[] = [
    ...baseLines.map((l) => ({ label: l.label, cents: l.amountCents, on: true, fixed: true, hint: null as string | null })),
    ...extras.map((x) => ({
      label: x.label,
      cents: x.minCents,
      on: false,
      fixed: true,
      hint: x.minCents === x.maxCents ? formatCents(x.minCents) : `${formatCents(x.minCents)}–${formatCents(x.maxCents)}`,
    })),
    ...Array.from({ length: QUOTE_BLANK_ROWS }, () => ({ label: "", cents: 0, on: false, fixed: false, hint: null })),
  ];
  const form = draft ? <QuoteForm a={a} back={back} rows={rows} revising={revising} /> : null;

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

function QuoteForm({ a, back, rows, revising }: { a: AppointmentDetail; back: string; rows: Row[]; revising: boolean }) {
  const q = a.quote;
  const draft = a.quoteDraft!;
  return (
        <form action={sendQuoteAction} className="flex flex-col gap-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="rows" value={rows.length} />
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
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_7rem] items-center gap-2">
                {r.fixed ? (
                  <input type="checkbox" name={`on_${i}`} defaultChecked={r.on} aria-label={`Include ${r.label}`} className="checkbox" />
                ) : (
                  <>
                    <input type="hidden" name={`custom_${i}`} value="1" />
                    <span className="w-5" aria-hidden />
                  </>
                )}
                <div className="flex flex-col">
                  <input
                    name={`label_${i}`}
                    defaultValue={r.label}
                    maxLength={80}
                    placeholder={r.fixed ? undefined : "Other line, e.g. Ceramic spray coat"}
                    aria-label={`Line ${i + 1} description`}
                    className="field min-h-10 py-2"
                  />
                  {r.hint && <span className="text-xs text-ink-muted mt-0.5">Usually {r.hint}</span>}
                </div>
                <input
                  name={`amount_${i}`}
                  defaultValue={r.cents ? dollars(r.cents) : ""}
                  inputMode="decimal"
                  placeholder="$"
                  aria-label={`Line ${i + 1} amount ($)`}
                  className="field min-h-10 py-2 text-right"
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Discount ($)</span>
              <input name="discount" inputMode="decimal" defaultValue={revising && q?.discountCents ? dollars(q.discountCents) : ""} placeholder="0" className="field min-h-10 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Customer has to answer within</span>
              <select name="expiresInDays" defaultValue={String(draft.defaultExpiresInDays)} className="field min-h-10 py-2">
                {EXPIRY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} day{d > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
            Haven&apos;t seen the car? Tick a line and leave its amount blank: the customer sees &ldquo;Priced on site&rdquo; and it isn&apos;t in the total. Add the real price after the
            inspection with Change total.
          </p>
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
