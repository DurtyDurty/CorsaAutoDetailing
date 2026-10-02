import "server-only";
import { business, getService, getVehicleCategory } from "@/config/business";
import { getEmailAdapter } from "@/lib/email";
import { replyAddressFor } from "@/lib/inbound";
import type { AppointmentRecord, LeadRecord, LeadStore, NotificationKind, NotificationRecord } from "@/lib/leads/types";
import { billingSuffix, formatUsd } from "@/lib/pricing";
import { formatEastern } from "@/lib/time";
import { shortRef } from "@/lib/utils";

/**
 * Notifications are always recorded AFTER the lead is durably saved and never
 * throw back to the form. Failures are logged on the notification record and
 * can be retried from the admin dashboard or the retry endpoint.
 */

const LEAD_TYPE_LABEL: Record<LeadRecord["leadType"], string> = {
  launch_list: "Launch-list signup",
  quote_request: "Quote request",
  membership_interest: "Maintenance-plan interest",
  contact: "Contact message",
};

/** "Sat, Nov 7, 2026 at 9:00 AM ET" */
const whenLabel = (a: AppointmentRecord) => `${formatEastern(a.startsAt, { dateStyle: "full", timeStyle: "short" })} ET`;

function ownerSubject(lead: LeadRecord, booking?: AppointmentRecord, requested?: AppointmentRecord) {
  if (requested) {
    return `[${business.brand.shortName}] Time requested: ${lead.firstName}, ${formatEastern(requested.startsAt, { dateStyle: "medium", timeStyle: "short" })}. Confirm in the app (${shortRef(lead.id)})`;
  }
  if (booking) {
    return `[${business.brand.shortName}] New booking: ${lead.firstName}, ${formatEastern(booking.startsAt, { dateStyle: "medium", timeStyle: "short" })} (${shortRef(lead.id)})`;
  }
  return `[${business.brand.shortName}] ${LEAD_TYPE_LABEL[lead.leadType]}: ${lead.firstName} (${shortRef(lead.id)})`;
}

/** Internal notes are intentionally excluded from every email. */
function ownerBody(lead: LeadRecord, booking?: AppointmentRecord, requested?: AppointmentRecord) {
  const lines = [
    requested
      ? `Requested time: ${whenLabel(requested)}. It's held until ${formatEastern(requested.holdExpiresAt ?? requested.startsAt)} ET. Confirm or decline it in the Corsa Owner app.`
      : booking
        ? `Online booking for ${whenLabel(booking)}. Deposit ${formatUsd((booking.depositCents ?? 0) / 100)} paid.`
        : `${LEAD_TYPE_LABEL[lead.leadType]} received ${formatEastern(lead.createdAt)} ET`,
    `Reference: ${shortRef(lead.id)}`,
    `Mode: ${lead.businessMode}`,
    "",
    `Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(" ")}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.preferredContact ? `Preferred contact: ${lead.preferredContact}` : null,
    lead.serviceAddress ? `Service address: ${lead.serviceAddress}` : null,
    lead.zip ? `ZIP: ${lead.zip} (${lead.zipEligibility ?? "unclassified"})${lead.city ? `, ${lead.city}` : ""}` : null,
  ];
  if (lead.serviceId || lead.vehicleCategory) {
    lines.push(
      "",
      `Service: ${getService(lead.serviceId ?? "")?.name ?? lead.serviceId ?? "n/a"}`,
      `Vehicle: ${[lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") || "n/a"}${lead.vehicleCategory ? ` (${getVehicleCategory(lead.vehicleCategory)?.label ?? lead.vehicleCategory})` : ""}`,
    );
  }
  if (lead.condition) {
    lines.push(
      `Condition: ${lead.condition}${lead.conditionFlags.length ? `. Flags: ${lead.conditionFlags.join(", ")}` : ""}`,
    );
  }
  if (lead.concerns) lines.push(`Concerns: ${lead.concerns}`);
  if (lead.locationType) lines.push(`Location: ${lead.locationType}`);
  if (lead.timeWindows.length) lines.push(`Preferred windows: ${lead.timeWindows.join(", ")}`);
  if (lead.preferredDate) lines.push(`Preferred date: ${lead.preferredDate}`);
  if (lead.membershipCadence) lines.push(`Plan cadence interest: ${lead.membershipCadence}`);
  if (lead.futureInterests.length) lines.push(`Future interests: ${lead.futureInterests.join(", ")}`);
  if (lead.estimate) {
    lines.push(
      "",
      `Estimate (${lead.estimate.pricingVersion}): ${lead.estimate.total !== null ? formatUsd(lead.estimate.total) : "custom quote"}`,
    );
  }
  if (lead.notes) lines.push("", `Customer notes:`, lead.notes);
  if (lead.message) lines.push("", `Message:`, lead.message);
  if (lead.consent.priceAcknowledgedAt) {
    lines.push(`Price-estimate acknowledgment: ${formatEastern(lead.consent.priceAcknowledgedAt)} ET (${lead.consent.priceAcknowledgmentTextVersion})`);
  }
  lines.push("", `Marketing email opt-in: ${lead.consent.marketingEmail ? "yes" : "no"}`);
  lines.push("", `Open in dashboard: ${business.brand.canonicalDomain}/admin/leads/${lead.id}`);
  return lines.filter((l) => l !== null).join("\n");
}

function customerSubject(lead: LeadRecord, booking?: AppointmentRecord, requested?: AppointmentRecord) {
  if (requested) {
    return `${business.brand.name}: we received your request for ${formatEastern(requested.startsAt, { dateStyle: "medium", timeStyle: "short" })}`;
  }
  if (booking) {
    return `${business.brand.name}: you're booked for ${formatEastern(booking.startsAt, { dateStyle: "medium", timeStyle: "short" })}`;
  }
  switch (lead.leadType) {
    case "launch_list":
      return `You're on the ${business.brand.name} launch list`;
    case "quote_request":
      return `${business.brand.name}: we received your request`;
    case "membership_interest":
      return `${business.brand.name}: thanks for your interest in maintenance plans`;
    default:
      return `${business.brand.name}: we received your message`;
  }
}

/** Online booking confirmation, sent only after the deposit is paid. */
function bookingBody(lead: LeadRecord, booking: AppointmentRecord) {
  const deposit = (booking.depositCents ?? 0) / 100;
  const total = lead.estimate?.total ?? null;
  const lines = [
    `Hi ${lead.firstName},`,
    "",
    `You're booked. Here are the details:`,
    "",
    `When: ${whenLabel(booking)}`,
    `Package: ${getService(booking.serviceId ?? "")?.name ?? booking.serviceId ?? ""}`,
    `Vehicle: ${[lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ")}`,
    `Where: ${[lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ")}`,
    `Deposit paid: ${formatUsd(deposit)} (credited toward your final price)`,
    total !== null ? `Estimated balance: ${formatUsd(Math.max(0, total - deposit))}, due when the service is complete` : "",
    `Reference: ${shortRef(lead.id)}`,
    "",
    business.disclosures.inspection,
    "",
    "Deposit policy:",
    ...business.booking.policy.map((p) => `- ${p}`),
    "",
    `To reschedule or cancel, reply to this email${business.contact.email ? ` or write to ${business.contact.email}` : ""}.`,
    "",
    business.owner.name,
    business.brand.name,
  ];
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n");
}

/** Customer acknowledgement. Never confirms an appointment. */
function customerBody(lead: LeadRecord, requested?: AppointmentRecord) {
  const intro: Record<LeadRecord["leadType"], string> = {
    launch_list: `Thanks for joining the launch list. We're preparing to open in ${business.serviceAreas.region}, and you'll be among the first to hear when scheduling opens.`,
    quote_request:
      lead.businessMode === "PRELAUNCH"
        ? `Thanks for your request. We're not scheduling appointments yet because we're still preparing to launch, but we've saved your details and will reach out with a quote and timing once we open.`
        : requested
          ? `Thanks for your request. You asked for ${whenLabel(requested)}, and we're holding that time for you. It isn't confirmed yet: ${business.owner.name} will review your vehicle and location details, and you'll get a confirmation email once it is.`
          : `Thanks for your request. This is not a confirmed appointment yet. ${business.owner.name} will review your vehicle and location details and reply with a quote and available times.`,
    membership_interest: `Thanks for your interest in a maintenance plan. Plans aren't available yet and nothing has been charged. We'll share details once pricing and terms are finalized.`,
    contact: `Thanks for getting in touch. We've received your message and will reply as soon as we can.`,
  };
  const lines = [
    `Hi ${lead.firstName},`,
    "",
    intro[lead.leadType],
    "",
    `Reference: ${shortRef(lead.id)}`,
  ];
  if (lead.estimate && lead.leadType === "quote_request") {
    lines.push(
      "",
      `Estimate: ${lead.estimate.total !== null ? `${formatUsd(lead.estimate.total)}${billingSuffix(lead.estimate.billing)}` : "Custom quote"} for ${lead.estimate.serviceName}${lead.estimate.vehicleCategoryLabel ? ` (${lead.estimate.vehicleCategoryLabel})` : ""}.`,
      lead.estimate.finalQuoteNotice,
      lead.estimate.taxNotice,
    );
  }
  if (business.contact.responseHours) {
    lines.push("", `We typically reply during ${business.contact.responseHours}.`);
  }
  lines.push("", business.owner.name, business.brand.name);
  return lines.join("\n");
}

async function attempt(store: LeadStore, record: NotificationRecord, lead: LeadRecord): Promise<void> {
  const adapter = getEmailAdapter();
  if (adapter.kind === "disabled") {
    await store.updateNotification(record.id, {
      status: "skipped",
      lastError: "Email provider not configured.",
    });
    return;
  }
  const to = record.kind === "owner_notify" ? process.env.OWNER_NOTIFY_EMAIL : lead.email;
  if (!to) {
    await store.updateNotification(record.id, {
      status: "skipped",
      lastError: "OWNER_NOTIFY_EMAIL not configured.",
    });
    return;
  }
  try {
    // A paid online booking gets booking-specific emails; a calendar request names the time it holds.
    const appts = lead.leadType === "quote_request" ? await store.listAppointments({ leadId: lead.id }) : [];
    const booking = appts.find((a) => a.source === "online" && a.depositStatus === "paid");
    const requested = booking ? undefined : appts.find((a) => a.source === "online" && a.status === "held" && a.depositStatus === "none");
    // One send per attempt: two overlapping retries of the same row reach the customer once.
    const idempotencyKey = `notification-${record.id}-${record.attempts}`;
    const { id } = await adapter.send(
      record.kind === "owner_notify"
        ? { to, subject: ownerSubject(lead, booking, requested), text: ownerBody(lead, booking, requested), replyTo: lead.email, idempotencyKey }
        : {
            to,
            subject: customerSubject(lead, booking, requested),
            text: booking ? bookingBody(lead, booking) : customerBody(lead, requested),
            replyTo: replyAddressFor(lead.id) ?? business.contact.email ?? undefined,
            idempotencyKey,
          },
    );
    await store.updateNotification(record.id, {
      status: "sent",
      attempts: record.attempts + 1,
      providerMessageId: id,
      lastError: null,
    });
  } catch (err) {
    await store.updateNotification(record.id, {
      status: "failed",
      attempts: record.attempts + 1,
      lastError: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
    });
  }
}

/**
 * The forms accept any email address, so the acknowledgement must not become a
 * way to mail one address over and over. Counted from saved leads, so the limit
 * holds across server instances.
 */
const ACKS_PER_HOUR = 3;
const ACKS_PER_DAY = 5;

async function ackLimitReached(store: LeadStore, lead: LeadRecord): Promise<boolean> {
  const others = (await store.listLeads({ search: lead.email, includeArchived: true, limit: 50 })).filter(
    (l) => l.id !== lead.id && l.email === lead.email,
  );
  const within = (ms: number) => others.filter((l) => Date.now() - Date.parse(l.createdAt) < ms).length;
  return within(3_600_000) >= ACKS_PER_HOUR || within(86_400_000) >= ACKS_PER_DAY;
}

/**
 * Create and attempt both notifications for a freshly saved lead. Swallows all
 * errors — the caller already has a durable lead and must not fail.
 * `throttleAck: false` is for emails the customer is owed whatever came before
 * (a paid booking's confirmation).
 */
export async function notifyForLead(store: LeadStore, lead: LeadRecord, opts: { throttleAck?: boolean } = {}): Promise<void> {
  const kinds: NotificationKind[] = ["owner_notify", "customer_ack"];
  for (const kind of kinds) {
    try {
      const record = await store.createNotification(lead.id, kind);
      if (kind === "customer_ack" && opts.throttleAck !== false && (await ackLimitReached(store, lead))) {
        await store.updateNotification(record.id, {
          status: "skipped",
          lastError: "This address was already sent recent acknowledgements; not sent again.",
        });
        continue;
      }
      await attempt(store, record, lead);
    } catch (err) {
      console.error(`[notifications] ${kind} for lead ${lead.id} failed to record:`, err instanceof Error ? err.message : err);
    }
  }
}

const MAX_ATTEMPTS = 5;

/** Retry every failed notification. Used by the admin action and the cron endpoint. */
export async function retryFailedNotifications(store: LeadStore, leadId?: string): Promise<number> {
  const failed = await store.listNotifications({ status: "failed", leadId });
  let retried = 0;
  for (const n of failed) {
    // A send that keeps failing (bad address, provider rejection) stops being retried.
    if (n.attempts >= MAX_ATTEMPTS) continue;
    const lead = await store.getLead(n.leadId);
    if (!lead) continue;
    await attempt(store, n, lead);
    retried++;
  }
  return retried;
}
