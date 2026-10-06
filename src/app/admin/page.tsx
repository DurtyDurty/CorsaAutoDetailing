import type { Metadata } from "next";
import Link from "next/link";
import { QUOTE_STATUS_LABELS, type AppointmentSummary } from "@shared/api";
import { formatCents } from "@shared/money";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { todaySummary } from "@/lib/owner/summary";
import { formatEastern, todayEastern } from "@/lib/time";
import { formatPhone } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/admin/work/Flash";
import { StatusBadge } from "@/components/admin/work/StatusBadge";
import { StepButton } from "@/components/admin/work/StepButton";
import { nextStepFor } from "@/components/admin/work/next-step";

export const metadata: Metadata = { title: "Today" };

const time = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: "short" });
const range = (a: AppointmentSummary) => `${time(a.startsAt)} – ${time(a.endsAt)}`;
const vehicle = (a: AppointmentSummary) => [a.vehicle.year, a.vehicle.make, a.vehicle.model].filter(Boolean).join(" ");
const address = (a: AppointmentSummary) => [a.serviceAddress, a.city, a.zip].filter(Boolean).join(", ");
const mapsUrl = (addr: string) => `https://maps.google.com/?daddr=${encodeURIComponent(addr)}`;

function greeting(): string {
  const h = Number(formatEastern(new Date(), { dateStyle: undefined, timeStyle: undefined, hour: "numeric", hourCycle: "h23" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-line bg-white rounded-md px-4 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-2xl font-semibold mt-0.5">{value}</dd>
      <dd className="text-xs text-ink-muted">{hint}</dd>
    </div>
  );
}

/** The owner's command center, laid out like the app's Today screen. */
export default async function TodayPage({ searchParams }: PageProps<"/admin">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const s = await todaySummary(store);
  const f = s.focus;
  const step = f ? nextStepFor(f.status) : null;
  const waiting = s.newRequests + s.unreadMessages + s.awaitingConfirmation;
  const underway = f && ["en_route", "arrived", "in_progress"].includes(f.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">{formatEastern(new Date(), { dateStyle: "full", timeStyle: undefined })}</p>
          <h1 className="font-display text-4xl mt-1">{greeting()}</h1>
        </div>
        <ButtonLink href="/admin/book" variant="secondary" size="sm">
          + New appointment
        </ButtonLink>
      </div>

      <Flash ok={sp.ok} error={sp.error} />

      {s.toConfirm.length > 0 && (
        <section aria-labelledby="to-confirm" className="flex flex-col gap-3">
          <h2 id="to-confirm" className="text-xs uppercase tracking-[0.16em] font-semibold text-[#8a5a12]">
            To confirm ({s.toConfirm.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {s.toConfirm.map((a) => (
              <article key={a.id} className="border border-[#d9a441] bg-white rounded-md p-4 flex flex-col gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#8a5a12]">
                    Requested · {formatEastern(a.startsAt, { dateStyle: "medium", timeStyle: undefined })}
                  </p>
                  <Link href={`/admin/jobs/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                    {a.customerName}
                  </Link>
                  <p className="text-sm">{a.serviceName ?? "Service not set"}</p>
                  <p className="text-sm text-ink-muted">
                    {a.requested ? `Asked for: ${a.requested}` : range(a)}
                    {vehicle(a) && ` · ${vehicle(a)}`}
                  </p>
                  {address(a) && <p className="text-sm text-ink-muted">{address(a)}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StepButton
                    id={a.id}
                    to="declined"
                    label="Decline"
                    back="/admin"
                    variant="danger"
                    size="sm"
                    reason="Requested time not available"
                    confirm="Decline this request? The customer gets an email asking them to pick another time."
                  />
                  <ButtonLink href={`/admin/jobs/${a.id}#quote`} size="sm">
                    {a.quoteStatus === "sent" ? "View quote" : "Send quote"}
                  </ButtonLink>
                </div>
                <p className="text-xs text-ink-muted">
                  {a.quoteStatus ? QUOTE_STATUS_LABELS[a.quoteStatus] : "Send a quote: the job is confirmed when the customer accepts it."}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {f ? (
        <section aria-labelledby="focus" className="border border-line border-l-[3px] border-l-apex-deep bg-white rounded-md p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="focus" className="text-xs uppercase tracking-[0.16em] text-ink-muted">
              {underway ? "Current job" : "Next job"}
            </h2>
            <StatusBadge status={f.status} />
          </div>
          <div>
            <p className="font-display text-3xl">{f.customerName}</p>
            <p className="font-medium">{f.serviceName ?? "Service not set"}</p>
            <p className="text-sm text-ink-muted">{range(f)}</p>
            {vehicle(f) && <p className="text-sm">{vehicle(f)}</p>}
            {address(f) && <p className="text-sm text-ink-muted">{address(f)}</p>}
            {f.balance.balanceDueCents > 0 && <p className="text-sm text-ink-muted">{formatCents(f.balance.balanceDueCents)} due</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {f.phone && (
              <>
                <ButtonLink href={`tel:${f.phone}`} variant="secondary" size="sm">
                  Call {formatPhone(f.phone)}
                </ButtonLink>
                <ButtonLink href={`sms:${f.phone}`} variant="secondary" size="sm">
                  Text
                </ButtonLink>
              </>
            )}
            {address(f) && (
              <a href={mapsUrl(address(f))} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-sm border border-asphalt px-3.5 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.08em] min-h-10">
                Navigate
              </a>
            )}
            <ButtonLink href={`/admin/jobs/${f.id}`} variant="ghost" size="sm">
              Details, payment &amp; notes
            </ButtonLink>
          </div>
          {step && <StepButton id={f.id} to={step.to} label={step.label} back="/admin" confirm={step.confirm} size="lg" />}
        </section>
      ) : (
        <section className="border border-dashed border-line rounded-md px-5 py-6 text-center">
          <p className="font-medium">{s.timeline.length > 0 ? "Done for today" : "No jobs today"}</p>
          <p className="text-sm text-ink-muted mt-1">
            {s.nextJob ? (
              <>
                Next job:{" "}
                <Link href={`/admin/jobs/${s.nextJob.id}`} className="underline underline-offset-4">
                  {formatEastern(s.nextJob.startsAt, { dateStyle: "medium", timeStyle: "short" })}, {s.nextJob.customerName}
                </Link>{" "}
                ({s.nextJob.serviceName ?? "service not set"})
              </>
            ) : (
              "Nothing booked yet. New website requests appear here to confirm."
            )}
          </p>
        </section>
      )}

      <Link href="/admin/inbox" className="flex flex-col gap-2 group" aria-label={`Needs you: ${s.newRequests} new requests, ${s.unreadMessages} messages, ${s.awaitingConfirmation} to confirm. Opens the inbox.`}>
        <span className="flex justify-between text-xs uppercase tracking-[0.16em]">
          <span className={waiting > 0 ? "text-apex-deep font-semibold" : "text-ink-muted"}>{waiting > 0 ? "Needs you" : "All caught up"}</span>
          <span className="text-ink-muted normal-case tracking-normal group-hover:underline">Open inbox ›</span>
        </span>
        <span className="grid grid-cols-3 gap-2">
          {[
            [s.newRequests, "New requests"],
            [s.unreadMessages, "Messages"],
            [s.awaitingConfirmation, "To confirm"],
          ].map(([n, label]) => (
            <span key={label} className={`border rounded-md bg-white px-4 py-3 ${Number(n) > 0 ? "border-apex-deep" : "border-line"}`}>
              <span className={`block text-2xl font-semibold ${Number(n) > 0 ? "" : "text-ink-muted"}`}>{n}</span>
              <span className="block text-xs text-ink-muted">{label}</span>
            </span>
          ))}
        </span>
      </Link>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Booked today" value={formatCents(s.today.bookedCents)} hint={`${s.today.jobs} ${s.today.jobs === 1 ? "job" : "jobs"}`} />
        <Stat label="Still to collect" value={formatCents(s.today.outstandingCents)} hint={`${formatCents(s.today.collectedCents)} collected`} />
        <Stat label="This week" value={formatCents(s.week.bookedCents)} hint={`${s.week.jobs} booked`} />
        <Stat label="This month" value={formatCents(s.month.bookedCents)} hint={`${s.month.jobs} booked`} />
      </dl>

      <section aria-labelledby="schedule" className="flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <h2 id="schedule" className="text-xs uppercase tracking-[0.16em] text-ink-muted">
            Today&rsquo;s schedule
          </h2>
          <Link href={`/admin/calendar?day=${todayEastern()}`} className="text-sm underline underline-offset-4">
            Calendar
          </Link>
        </div>
        {s.timeline.length === 0 ? (
          <p className="text-sm text-ink-muted">No jobs today.</p>
        ) : (
          <ol className="border border-line bg-white rounded-md divide-y divide-line">
            {s.timeline.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/jobs/${a.id}`} className="flex gap-5 px-4 py-3 hover:bg-chalk">
                  <span className={`w-20 shrink-0 font-semibold ${a.id === f?.id ? "text-apex-deep" : ""}`}>{time(a.startsAt)}</span>
                  <span className="flex flex-col gap-1 min-w-0">
                    <span className="font-medium">{a.customerName}</span>
                    <span className="text-sm text-ink-muted">{a.serviceName ?? "Service not set"}</span>
                    <StatusBadge status={a.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
