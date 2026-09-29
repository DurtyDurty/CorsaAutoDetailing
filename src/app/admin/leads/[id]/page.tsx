import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business, getService, getVehicleCategory } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/leads/types";
import { formatEastern, todayEastern } from "@/lib/time";
import { formatUsd } from "@/lib/pricing";
import { formatPhone, shortRef } from "@/lib/utils";
import { StageBadge } from "@/components/admin/LeadTable";
import { Button } from "@/components/ui/Button";
import { ComposeEmail } from "@/components/admin/ComposeEmail";
import { defaultEmailSubject, ownerSignature } from "@/lib/owner-email";
import {
  archiveLeadAction,
  cancelAppointmentAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  deleteLeadAction,
  retryNotificationsAction,
  updateLeadAction,
} from "../../actions";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 border-b border-line last:border-0 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join(", ") : value}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params, searchParams }: PageProps<"/admin/leads/[id]">) {
  await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const lead = await store.getLead(id);
  if (!lead) notFound();
  const [appointments, notifications, sentEmails] = await Promise.all([
    store.listAppointments({ leadId: id }),
    store.listNotifications({ leadId: id }),
    store.listOutboundEmails(id),
  ]);
  const activeAppt = appointments.find((a) => a.status === "confirmed");
  const heldAppt = appointments.find((a) => a.status === "held");
  const failedNotifs = notifications.filter((n) => n.status === "failed").length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← All leads
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{[lead.firstName, lead.lastName].filter(Boolean).join(" ")}</h1>
          <StageBadge stage={lead.stage} />
          {lead.archivedAt && <span className="text-xs text-ink-muted">Archived</span>}
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Ref {shortRef(lead.id)} · {lead.leadType.replace("_", " ")} · received {formatEastern(lead.createdAt)} ET · mode {lead.businessMode}
        </p>
      </div>

      {typeof sp.ok === "string" && (
        <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
          {sp.ok}
        </p>
      )}
      {typeof sp.error === "string" && (
        <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
          {sp.error}
        </p>
      )}

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="flex flex-col gap-6">
          <section className="border border-line bg-white rounded-md p-5">
            <h2 className="font-medium">Contact</h2>
            <dl className="mt-3">
              <Row label="Email" value={<a href={`mailto:${lead.email}`} className="underline underline-offset-4">{lead.email}</a>} />
              <Row label="Phone" value={lead.phone ? <a href={`tel:+1${lead.phone}`} className="underline underline-offset-4">{formatPhone(lead.phone)}</a> : null} />
              <Row label="Prefers" value={lead.preferredContact} />
              <Row label="Marketing email" value={lead.consent.marketingEmail ? `Opted in (${lead.consent.marketingTextVersion})` : "Not opted in"} />
              <Row label="Service consent" value={`${lead.consent.serviceTextVersion} · ${formatEastern(lead.consent.serviceAcceptedAt)}`} />
              <Row
                label="Price estimate ack."
                value={
                  lead.consent.priceAcknowledgedAt
                    ? `${lead.consent.priceAcknowledgmentTextVersion} · ${formatEastern(lead.consent.priceAcknowledgedAt)}`
                    : null
                }
              />
            </dl>
          </section>

          {sentEmails.length > 0 && (
            <section className="border border-line bg-white rounded-md p-5">
              <h2 className="font-medium">Emails you sent</h2>
              <ul className="mt-3 text-sm divide-y divide-line">
                {sentEmails.map((e) => (
                  <li key={e.id} className="py-2">
                    <details>
                      <summary className="cursor-pointer">
                        <span className="font-medium">{e.subject}</span>
                        <span className="text-ink-muted"> · {formatEastern(e.createdAt)} ET</span>
                        {e.status === "failed" && <span className="text-error"> · not sent</span>}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-ink-muted">{e.body}</p>
                      {e.error && <p className="mt-1 text-error">{e.error}</p>}
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(lead.serviceId || lead.vehicleCategory || lead.condition) && (
            <section className="border border-line bg-white rounded-md p-5">
              <h2 className="font-medium">Vehicle & service</h2>
              <dl className="mt-3">
                <Row label="Service" value={lead.serviceId ? (getService(lead.serviceId)?.name ?? lead.serviceId) : null} />
                <Row label="Category" value={lead.vehicleCategory ? getVehicleCategory(lead.vehicleCategory)?.label : null} />
                <Row label="Vehicle" value={[lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ")} />
                <Row label="Condition" value={lead.condition} />
                <Row label="Flags" value={lead.conditionFlags} />
                <Row label="Concerns" value={lead.concerns} />
                <Row
                  label="Estimate"
                  value={
                    lead.estimate
                      ? `${lead.estimate.total !== null ? formatUsd(lead.estimate.total) : "Custom quote"} (${lead.estimate.pricingVersion})`
                      : null
                  }
                />
                <Row label="Review notes" value={lead.estimate?.reviewNotes} />
              </dl>
            </section>
          )}

          {(lead.zip || lead.serviceAddress || lead.timeWindows.length > 0 || lead.notes || lead.message) && (
            <section className="border border-line bg-white rounded-md p-5">
              <h2 className="font-medium">Location, timing & notes</h2>
              <dl className="mt-3">
                <Row label="ZIP" value={lead.zip ? `${lead.zip} · ${lead.zipEligibility}` : null} />
                <Row label="Service address" value={lead.serviceAddress} />
                <Row label="City" value={lead.city} />
                <Row label="Location" value={lead.locationType} />
                <Row label="Windows" value={lead.timeWindows} />
                <Row label="Preferred date" value={lead.preferredDate} />
                <Row label="Customer notes" value={lead.notes} />
                <Row label="Message" value={lead.message} />
                <Row label="Plan cadence" value={lead.membershipCadence} />
                <Row label="Future interests" value={lead.futureInterests} />
              </dl>
            </section>
          )}

          {lead.photoRefs.length > 0 && (
            <section className="border border-line bg-white rounded-md p-5">
              <h2 className="font-medium">Photos</h2>
              <ul className="mt-3 flex flex-wrap gap-3">
                {lead.photoRefs.map((ref, i) => (
                  <li key={ref}>
                    <a href={`/admin/photos?ref=${encodeURIComponent(ref)}`} target="_blank" rel="noopener" className="underline underline-offset-4 text-sm">
                      Photo {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-muted mt-2">Links open a private, short-lived signed URL.</p>
            </section>
          )}

          <section className="border border-line bg-white rounded-md p-5">
            <h2 className="font-medium">Source</h2>
            <dl className="mt-3">
              <Row label="Landing page" value={lead.source.landingPath} />
              <Row label="Referrer" value={lead.source.referrer} />
              <Row label="UTM" value={[lead.source.utmSource, lead.source.utmMedium, lead.source.utmCampaign].filter(Boolean).join(" / ")} />
            </dl>
          </section>

          <section className="border border-line bg-white rounded-md p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Notifications</h2>
              {failedNotifs > 0 && (
                <form action={retryNotificationsAction}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Retry failed ({failedNotifs})
                  </Button>
                </form>
              )}
            </div>
            <ul className="mt-3 text-sm divide-y divide-line">
              {notifications.length === 0 && <li className="py-2 text-ink-muted">None recorded.</li>}
              {notifications.map((n) => (
                <li key={n.id} className="py-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">{n.kind === "owner_notify" ? "Owner alert" : "Customer acknowledgement"}</span>
                  <span className="capitalize">{n.status}</span>
                  <span className="text-ink-muted">attempts {n.attempts}</span>
                  {n.lastError && <span className="text-error basis-full">{n.lastError}</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <ComposeEmail
            leadId={lead.id}
            firstName={lead.firstName}
            to={lead.email}
            from={business.contact.email ?? "the business address"}
            defaultSubject={defaultEmailSubject(lead)}
            signature={ownerSignature()}
            initialSendKey={randomUUID()}
          />
          <form action={updateLeadAction} className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <h2 className="font-medium">Follow-up</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="stage" className="text-sm font-medium">
                Stage
              </label>
              <select id="stage" name="stage" defaultValue={lead.stage} className="field">
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="followUpOn" className="text-sm font-medium">
                Follow-up date
              </label>
              <input id="followUpOn" name="followUpOn" type="date" defaultValue={lead.followUpOn ?? ""} min={todayEastern()} className="field" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="internalNotes" className="text-sm font-medium">
                Internal notes <span className="text-ink-muted font-normal">(never sent to the customer)</span>
              </label>
              <textarea id="internalNotes" name="internalNotes" defaultValue={lead.internalNotes ?? ""} className="field min-h-32" maxLength={5000} />
            </div>
            <Button type="submit">Save</Button>
          </form>

          {lead.leadType === "quote_request" && (
            <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
              <h2 className="font-medium">Appointment</h2>
              {activeAppt ? (
                <div className="text-sm flex flex-col gap-3">
                  <p>
                    Confirmed for <strong>{formatEastern(activeAppt.startsAt)}</strong> to {formatEastern(activeAppt.endsAt, { timeStyle: "short", dateStyle: undefined })} ET
                    <br />
                    Quoted {formatUsd(activeAppt.quotedPriceCents / 100)}
                    {activeAppt.source === "online" && (
                      <span className="block mt-1">
                        Booked online · deposit {formatUsd((activeAppt.depositCents ?? 0) / 100)} <strong>{activeAppt.depositStatus}</strong>
                      </span>
                    )}
                    {activeAppt.notes && <span className="block text-ink-muted mt-1">{activeAppt.notes}</span>}
                  </p>
                  <form action={completeAppointmentAction} className="flex flex-col gap-3 border-t border-line pt-3">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="appointmentId" value={activeAppt.id} />
                    <label htmlFor="revenue" className="text-sm font-medium">
                      Amount collected ($)
                    </label>
                    <input id="revenue" name="revenue" type="number" min="0" step="0.01" defaultValue={(activeAppt.quotedPriceCents / 100).toFixed(2)} className="field" required />
                    <Button type="submit" size="sm">
                      Mark completed & record revenue
                    </Button>
                  </form>
                  {activeAppt.depositStatus === "paid" ? (
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                      <p className="text-ink-muted">
                        Policy: full refund with {business.booking.cancellationHours}+ hours&rsquo; notice or for weather; deposit kept for later cancellations and no-shows.
                      </p>
                      <form action={cancelAppointmentAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="appointmentId" value={activeAppt.id} />
                        <Button type="submit" name="deposit" value="refund" variant="secondary" size="sm">
                          Cancel &amp; refund deposit
                        </Button>
                        <Button type="submit" name="deposit" value="keep" variant="ghost" size="sm">
                          Cancel &amp; keep deposit
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <form action={cancelAppointmentAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="appointmentId" value={activeAppt.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Cancel appointment
                      </Button>
                    </form>
                  )}
                </div>
              ) : heldAppt ? (
                <p className="text-sm text-ink-muted">
                  Online booking in progress: {formatEastern(heldAppt.startsAt)} ET is held until {heldAppt.holdExpiresAt ? formatEastern(heldAppt.holdExpiresAt) : "payment"} while the customer pays the deposit.
                </p>
              ) : business.mode !== "LIVE" ? (
                <p className="text-sm text-ink-muted">
                  Appointments can&rsquo;t be confirmed while the site is in PRELAUNCH mode. Set NEXT_PUBLIC_BUSINESS_MODE=LIVE when you open.
                </p>
              ) : (
                <form action={confirmAppointmentAction} className="flex flex-col gap-3">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <p className="text-xs text-ink-muted">
                    Only confirm after the customer has agreed to the time and price. Conflicts with other confirmed appointments (plus a{" "}
                    {business.scheduling.travelBufferMinutes}-minute buffer) and work hours are checked.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="date" className="text-sm font-medium">Date (ET)</label>
                      <input id="date" name="date" type="date" min={todayEastern()} defaultValue={lead.preferredDate ?? ""} className="field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="time" className="text-sm font-medium">Start time (ET)</label>
                      <input id="time" name="time" type="time" defaultValue={business.scheduling.workHours.start} className="field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="durationMinutes" className="text-sm font-medium">Duration (min)</label>
                      <input id="durationMinutes" name="durationMinutes" type="number" min="15" max="600" step="15" defaultValue={business.scheduling.defaultDurationMinutes} className="field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="quotedPrice" className="text-sm font-medium">Quoted price ($)</label>
                      <input id="quotedPrice" name="quotedPrice" type="number" min="0" step="0.01" defaultValue={lead.estimate?.total ?? ""} className="field" required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="apptNotes" className="text-sm font-medium">Notes</label>
                    <input id="apptNotes" name="notes" className="field" maxLength={1000} />
                  </div>
                  <label className="flex gap-2 items-start text-sm">
                    <input type="checkbox" name="customerAgreed" className="checkbox" required />
                    The customer agreed to this time and price.
                  </label>
                  <label className="flex gap-2 items-start text-sm text-ink-muted">
                    <input type="checkbox" name="overrideConflicts" className="checkbox" />
                    Override conflict / work-hour checks
                  </label>
                  <Button type="submit">Confirm appointment</Button>
                </form>
              )}
              {appointments.filter((a) => a.status !== "confirmed").length > 0 && (
                <ul className="text-xs text-ink-muted border-t border-line pt-3 space-y-1">
                  {appointments
                    .filter((a) => a.status !== "confirmed")
                    .map((a) => (
                      <li key={a.id}>
                        {formatEastern(a.startsAt)} · {a.status}
                        {a.completedRevenueCents !== null && ` · ${formatUsd(a.completedRevenueCents / 100)}`}
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}

          <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
            <h2 className="font-medium">Archive or delete</h2>
            <form action={archiveLeadAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              {lead.archivedAt && <input type="hidden" name="unarchive" value="1" />}
              <Button type="submit" variant="secondary" size="sm">
                {lead.archivedAt ? "Restore" : "Archive"}
              </Button>
            </form>
            <form action={deleteLeadAction} className="flex flex-col gap-2 border-t border-line pt-4">
              <input type="hidden" name="leadId" value={lead.id} />
              <label htmlFor="confirm" className="text-sm">
                Type <strong>DELETE</strong> to permanently remove this lead, its appointments, notifications and photos.
              </label>
              <input id="confirm" name="confirm" className="field" autoComplete="off" />
              <Button type="submit" variant="danger" size="sm">
                Delete permanently
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
