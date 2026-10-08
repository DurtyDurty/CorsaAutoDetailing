import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { APPOINTMENT_STATUS_LABELS } from "@shared/appointment-status";
import { formatCents, PAYMENT_METHOD_LABELS } from "@shared/money";
import { requireOwner } from "@/lib/auth/owner";
import { ApiError } from "@/lib/api/http";
import { getLeadStore } from "@/lib/leads/store";
import { getAppointmentDetail } from "@/lib/owner/appointments";
import { conditionFlagLabel } from "@/lib/pricing";
import { formatEastern } from "@/lib/time";
import { formatPhone } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmSubmit } from "@/components/admin/work/ConfirmSubmit";
import { Flash } from "@/components/admin/work/Flash";
import { StatusBadge } from "@/components/admin/work/StatusBadge";
import { StepButton } from "@/components/admin/work/StepButton";
import { QuoteCard } from "@/components/admin/work/QuoteCard";
import { nextStepFor } from "@/components/admin/work/next-step";
import { noteAction, receiptAction, recordPaymentAction, rescheduleAction, changeStatusAction } from "../actions";

export const metadata: Metadata = { title: "Job" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const when = (iso: string) => formatEastern(iso, { dateStyle: "medium", timeStyle: "short" });
const DURATIONS = [60, 90, 120, 180, 240, 300, 360];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-3" aria-label={title}>
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Eastern date and time for form defaults. */
function easternParts(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: business.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: business.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { date, time };
}

export default async function JobPage({ params, searchParams }: PageProps<"/admin/jobs/[id]">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;

  let a;
  try {
    a = await getAppointmentDetail(store, id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  }

  const back = `/admin/jobs/${a.id}`;
  const step = nextStepFor(a.status);
  const allowed = new Set(a.allowedTransitions);
  const b = a.balance;
  const vehicle = [a.vehicle.year, a.vehicle.make, a.vehicle.model].filter(Boolean).join(" ");
  const address = [a.serviceAddress, a.city, a.zip].filter(Boolean).join(", ");
  const minutes = Math.round((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000);
  const start = easternParts(a.startsAt);
  const movable = a.status === "confirmed" || a.status === "held";
  const notes = a.events.filter((e) => e.type === "note" && e.actor !== "website" && e.actor !== "stripe");

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <Link href={`/admin/calendar?day=${start.date}`} className="text-sm underline underline-offset-4 w-fit">
        ← Calendar
      </Link>

      <header className="flex flex-col gap-1.5">
        <StatusBadge status={a.status} />
        <h1 className="font-display text-4xl">{a.customerName}</h1>
        <p className="font-medium">{a.serviceName ?? "Service not set"}</p>
        <p className="text-sm text-ink-muted">
          {formatEastern(a.startsAt, { dateStyle: "full", timeStyle: undefined })} · {formatEastern(a.startsAt, { dateStyle: undefined, timeStyle: "short" })} –{" "}
          {formatEastern(a.endsAt, { dateStyle: undefined, timeStyle: "short" })}
        </p>
        {a.status === "held" && a.requested && <p className="text-sm">Customer asked for: <strong>{a.requested}</strong>. Set the exact time with the quote.</p>}
      </header>

      <Flash ok={sp.ok} error={sp.error} />

      {step && <StepButton id={a.id} to={step.to} label={step.label} back={back} confirm={step.confirm} size="lg" />}
      {a.status === "completed" && b.balanceDueCents > 0 && (
        <a href="#payment" className="inline-flex justify-center rounded-sm bg-apex-deep text-white font-semibold uppercase tracking-[0.08em] px-7 py-3.5 min-h-14 items-center">
          Collect {formatCents(b.balanceDueCents)}
        </a>
      )}
      {a.status === "completed" && b.balanceDueCents === 0 && (
        <p className="border border-success/40 bg-[#eef6ef] text-success font-medium rounded-md px-4 py-3">✓ Closed out: completed and paid in full</p>
      )}

      <QuoteCard a={a} back={back} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Customer">
          <dl className="flex flex-col gap-1.5">
            <Row label="Phone" value={a.phone ? formatPhone(a.phone) : null} />
            <Row label="Email" value={a.email} />
            <Row label="Address" value={address} />
            <Row label="Prefers" value={a.customer.preferredContact} />
          </dl>
          <div className="flex flex-wrap gap-2">
            {a.phone && (
              <ButtonLink href={`tel:${a.phone}`} variant="secondary" size="sm">
                Call
              </ButtonLink>
            )}
            {a.phone && (
              <ButtonLink href={`sms:${a.phone}`} variant="secondary" size="sm">
                Text
              </ButtonLink>
            )}
            <ButtonLink href={`/admin/inbox/${a.leadId}`} variant="secondary" size="sm">
              Email
            </ButtonLink>
            {address && (
              <a href={`https://maps.google.com/?daddr=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-sm border border-asphalt px-3.5 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.08em] min-h-10">
                Navigate
              </a>
            )}
          </div>
        </Card>

        <Card title="Job">
          <dl className="flex flex-col gap-1.5">
            <Row label="Vehicle" value={vehicle ? `${vehicle}${a.vehicle.sizeLabel ? ` (${a.vehicle.sizeLabel})` : ""}` : null} />
            <Row label="Condition" value={a.customerNotes.condition} />
            <Row label="Noted" value={a.customerNotes.conditionFlags.map(conditionFlagLabel).join(", ")} />
            <Row label="Concerns" value={a.customerNotes.concerns} />
            <Row label="About the space" value={a.customerNotes.spaceNotes} />
            <Row label="Booked via" value={a.source === "online" ? "Website" : "You"} />
            {a.cancelReason && <Row label={a.status === "cancelled" ? `Cancelled by ${a.cancelledBy ?? "?"}` : "Reason"} value={a.cancelReason} />}
          </dl>
          <Link href={`/admin/leads/${a.leadId}`} className="text-sm underline underline-offset-4 w-fit">
            Full customer record
          </Link>
        </Card>

        <Card title="Money">
          <dl className="flex flex-col gap-1.5" id="payment">
            <Row label="Price" value={formatCents(b.totalCents)} />
            {a.discountCents > 0 && <Row label="Discount" value={`-${formatCents(a.discountCents)}`} />}
            {b.depositPaidCents > 0 && <Row label="Deposit paid" value={formatCents(b.depositPaidCents)} />}
            <Row label="Collected" value={formatCents(b.collectedCents)} />
            <Row label="Still due" value={<strong>{formatCents(b.balanceDueCents)}</strong>} />
            {b.refundedCents > 0 && <Row label="Refunded" value={formatCents(b.refundedCents)} />}
          </dl>
          {a.payments.length > 0 && (
            <ul className="text-sm text-ink-muted flex flex-col gap-0.5">
              {a.payments.map((p) => (
                <li key={p.id}>
                  {when(p.createdAt)} · {p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Payment"} {formatCents(p.amountCents)} · {PAYMENT_METHOD_LABELS[p.method]}
                  {p.note ? ` · ${p.note}` : ""}
                </li>
              ))}
            </ul>
          )}
          {a.status !== "held" && a.status !== "declined" && (
            <form action={recordPaymentAction} className="flex flex-col gap-3 border-t border-line pt-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="requestId" value={randomUUID()} />
              <input type="hidden" name="back" value={back} />
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Amount ($)</span>
                  <input aria-label="Amount ($)" name="amount" inputMode="decimal" defaultValue={b.balanceDueCents > 0 ? (b.balanceDueCents / 100).toFixed(2) : ""} required className="field min-h-10 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">How</span>
                  <select aria-label="How" name="method" className="field min-h-10 py-2" defaultValue="card_reader">
                    <option value="card_reader">Card reader</option>
                    <option value="cash">Cash</option>
                    <option value="digital">Digital (Zelle, Venmo, Cash App…)</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Note (optional)</span>
                <input name="note" maxLength={500} className="field min-h-10 py-2" placeholder="e.g. tip included" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="kind" value="balance" defaultChecked className="checkbox" /> Payment
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="kind" value="refund" className="checkbox" /> Refund
                </label>
                <ConfirmSubmit size="sm">Record</ConfirmSubmit>
              </div>
            </form>
          )}
          <form action={receiptAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="requestId" value={randomUUID()} />
            <input type="hidden" name="back" value={back} />
            <Button type="submit" variant="secondary" size="sm" disabled={b.collectedCents === 0}>
              Email receipt
            </Button>
          </form>
        </Card>

        <Card title="Private notes">
          {notes.length > 0 ? (
            <ul className="text-sm flex flex-col gap-1">
              {notes.map((e) => (
                <li key={e.id}>
                  {e.note} <span className="text-ink-muted">· {when(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Only you see these, never the customer.</p>
          )}
          <form action={noteAction} className="flex gap-2">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="requestId" value={randomUUID()} />
            <input type="hidden" name="back" value={back} />
            <input name="note" required maxLength={1000} placeholder="Gate code, pet, parking…" aria-label="Add a note" className="field min-h-10 py-2 flex-1 min-w-0" />
            <Button type="submit" variant="secondary" size="sm">
              Save
            </Button>
          </form>
        </Card>

        {movable && (
          <Card title="Reschedule">
            <form action={rescheduleAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="requestId" value={randomUUID()} />
              <input type="hidden" name="back" value={back} />
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-sm col-span-3 sm:col-span-1">
                  <span className="font-medium">Date</span>
                  <input aria-label="Date" type="date" name="date" defaultValue={start.date} required className="field min-h-10 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Time (ET)</span>
                  <input aria-label="Time (ET)" type="time" name="time" step={900} defaultValue={start.time} required className="field min-h-10 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Length</span>
                  <select aria-label="Length" name="durationMinutes" defaultValue={String(DURATIONS.includes(minutes) ? minutes : 180)} className="field min-h-10 py-2">
                    {DURATIONS.map((m) => (
                      <option key={m} value={m}>
                        {m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)}.5 hr`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notifyCustomer" defaultChecked className="checkbox" /> Email the customer the new time
              </label>
              {sp.canOverride === "1" && (
                <label className="flex items-center gap-2 text-sm text-[#8a5a12]">
                  <input type="checkbox" name="override" className="checkbox" /> Book anyway (outside working hours or a day off)
                </label>
              )}
              <div>
                <Button type="submit" variant="secondary" size="sm">
                  Move appointment
                </Button>
              </div>
            </form>
          </Card>
        )}

        {(allowed.has("cancelled") || allowed.has("no_show") || allowed.has("declined")) && (
          <Card title="Cancel">
            {allowed.has("declined") && (
              <StepButton
                id={a.id}
                to="declined"
                label={a.source === "owner" ? "Drop this quote" : "Decline request"}
                back={back}
                variant="danger"
                size="sm"
                reason={a.source === "owner" ? "Quote dropped by owner" : "Requested time not available"}
                confirm={
                  a.source === "owner"
                    ? "Drop this quote? The time is freed and any quote you sent stops working. The customer isn't emailed."
                    : "Decline this request? The customer gets an email asking them to pick another time."
                }
              />
            )}
            {allowed.has("cancelled") && (
              <form action={changeStatusAction} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="to" value="cancelled" />
                <input type="hidden" name="requestId" value={randomUUID()} />
                <input type="hidden" name="back" value={back} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Who cancelled</span>
                    <select aria-label="Who cancelled" name="cancelledBy" className="field min-h-10 py-2" defaultValue="customer">
                      <option value="customer">The customer</option>
                      <option value="owner">I did</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Reason (private)</span>
                    <input aria-label="Reason (private)" name="reason" required maxLength={500} className="field min-h-10 py-2" placeholder="e.g. rain" />
                  </label>
                </div>
                <div>
                  <ConfirmSubmit variant="danger" size="sm" confirm="Cancel this appointment? This frees the time.">
                    Cancel appointment
                  </ConfirmSubmit>
                </div>
              </form>
            )}
            {allowed.has("no_show") && (
              <StepButton id={a.id} to="no_show" label="Mark no-show" back={back} variant="ghost" size="sm" reason="Customer not there" confirm="Mark as no-show? The customer wasn't there." />
            )}
          </Card>
        )}
      </div>

      <Card title="History">
        <ol className="text-sm text-ink-muted flex flex-col gap-1">
          {a.events.map((e) => (
            <li key={e.id}>
              {when(e.createdAt)} ·{" "}
              {e.type === "status" && e.toStatus
                ? `${e.fromStatus ? `${APPOINTMENT_STATUS_LABELS[e.fromStatus]} → ` : ""}${APPOINTMENT_STATUS_LABELS[e.toStatus]}`
                : e.type === "created"
                  ? "Booked"
                  : e.type === "rescheduled"
                    ? "Rescheduled"
                    : e.type === "payment"
                      ? "Payment"
                      : "Note"}
              {e.note ? `: ${e.note}` : ""} <span className="text-xs">({e.actor})</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
