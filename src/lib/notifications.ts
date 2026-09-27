import "server-only";
import { business, getService, getVehicleCategory } from "@/config/business";
import { getEmailAdapter } from "@/lib/email";
import type { LeadRecord, LeadStore, NotificationKind, NotificationRecord } from "@/lib/leads/types";
import { formatUsd } from "@/lib/pricing";
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

function ownerSubject(lead: LeadRecord) {
  return `[${business.brand.shortName}] ${LEAD_TYPE_LABEL[lead.leadType]} — ${lead.firstName} (${shortRef(lead.id)})`;
}

/** Internal notes are intentionally excluded from every email. */
function ownerBody(lead: LeadRecord) {
  const lines = [
    `${LEAD_TYPE_LABEL[lead.leadType]} received ${formatEastern(lead.createdAt)} ET`,
    `Reference: ${shortRef(lead.id)}`,
    `Mode: ${lead.businessMode}`,
    "",
    `Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(" ")}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.preferredContact ? `Preferred contact: ${lead.preferredContact}` : null,
    lead.serviceAddress ? `Service address: ${lead.serviceAddress}` : null,
    lead.zip ? `ZIP: ${lead.zip} (${lead.zipEligibility ?? "unclassified"})${lead.city ? ` — ${lead.city}` : ""}` : null,
  ];
  if (lead.serviceId || lead.vehicleCategory) {
    lines.push(
      "",
      `Service: ${getService(lead.serviceId ?? "")?.name ?? lead.serviceId ?? "—"}`,
      `Vehicle: ${[lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") || "—"} (${getVehicleCategory(lead.vehicleCategory ?? "")?.label ?? lead.vehicleCategory ?? "—"})`,
    );
  }
  if (lead.condition) {
    lines.push(
      `Condition: ${lead.condition}${lead.conditionFlags.length ? ` — ${lead.conditionFlags.join(", ")}` : ""}`,
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

function customerSubject(lead: LeadRecord) {
  switch (lead.leadType) {
    case "launch_list":
      return `You're on the ${business.brand.name} launch list`;
    case "quote_request":
      return `We received your request — ${business.brand.name}`;
    case "membership_interest":
      return `Thanks for your interest in maintenance plans — ${business.brand.name}`;
    default:
      return `We received your message — ${business.brand.name}`;
  }
}

/** Customer acknowledgement. Never confirms an appointment. */
function customerBody(lead: LeadRecord) {
  const intro: Record<LeadRecord["leadType"], string> = {
    launch_list: `Thanks for joining the launch list. We're preparing to open in ${business.serviceAreas.region}, and you'll be among the first to hear when scheduling opens.`,
    quote_request:
      lead.businessMode === "PRELAUNCH"
        ? `Thanks for your request. We're not scheduling appointments yet — we're still preparing to launch — but we've saved your details and will reach out with a quote and timing once we open.`
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
      `Estimate: ${lead.estimate.total !== null ? formatUsd(lead.estimate.total) : "Custom quote"} for ${lead.estimate.serviceName} (${lead.estimate.vehicleCategoryLabel}).`,
      lead.estimate.finalQuoteNotice,
      lead.estimate.taxNotice,
    );
  }
  if (business.contact.responseHours) {
    lines.push("", `We typically reply during ${business.contact.responseHours}.`);
  }
  lines.push("", `— ${business.owner.name}`, business.brand.name);
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
    const { id } = await adapter.send(
      record.kind === "owner_notify"
        ? { to, subject: ownerSubject(lead), text: ownerBody(lead), replyTo: lead.email }
        : {
            to,
            subject: customerSubject(lead),
            text: customerBody(lead),
            replyTo: business.contact.email ?? undefined,
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
 * Create and attempt both notifications for a freshly saved lead. Swallows all
 * errors — the caller already has a durable lead and must not fail.
 */
export async function notifyForLead(store: LeadStore, lead: LeadRecord): Promise<void> {
  const kinds: NotificationKind[] = ["owner_notify", "customer_ack"];
  for (const kind of kinds) {
    try {
      const record = await store.createNotification(lead.id, kind);
      await attempt(store, record, lead);
    } catch (err) {
      console.error(`[notifications] ${kind} for lead ${lead.id} failed to record:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Retry every failed notification. Used by the admin action and the cron endpoint. */
export async function retryFailedNotifications(store: LeadStore, leadId?: string): Promise<number> {
  const failed = await store.listNotifications({ status: "failed", leadId });
  let retried = 0;
  for (const n of failed) {
    const lead = await store.getLead(n.leadId);
    if (!lead) continue;
    await attempt(store, n, lead);
    retried++;
  }
  return retried;
}
