import "server-only";
import { computeBalance } from "@shared/money";
import { hasClickId } from "@/lib/attribution";
import type { AdConversionRecord, LeadStore } from "@/lib/leads/types";
import { deriveConversions, planUploads, type ConversionAppointment, type ConversionEvent, type SkippedConversion, type UploadReason } from "./conversions";
import { accessToken, DataManagerError, dataManagerConfig, enabledKinds, ingest, ingestBody, type DataManagerConfig } from "./data-manager";

export interface UploadResult {
  mode: DataManagerConfig["mode"] | "unconfigured";
  planned: { transactionId: string; kind: string; reason: UploadReason; valueCents: number }[];
  sent: number;
  failed: { transactionId: string; error: string }[];
  skipped: SkippedConversion[];
}

/** Records for every lead that came from a Google ad click, shaped for deriveConversions. */
export async function loadConversions(store: LeadStore) {
  const leads = (await store.listLeads({ includeArchived: true, limit: 5000 })).filter((l) => hasClickId(l.source));
  const appts = (await Promise.all(leads.map((l) => store.listAppointments({ leadId: l.id })))).flat();
  const payments = appts.length ? await store.listPayments({ appointmentIds: appts.map((a) => a.id) }) : [];
  const shaped: ConversionAppointment[] = await Promise.all(
    appts.map(async (a) => {
      const events = await store.listAppointmentEvents(a.id);
      const confirm = events.find((e) => e.toStatus === "confirmed");
      const mine = payments.filter((p) => p.appointmentId === a.id);
      const balance = computeBalance({
        quotedPriceCents: a.quotedPriceCents,
        discountCents: a.discountCents,
        depositCents: a.depositCents,
        depositStatus: a.depositStatus,
        completedRevenueCents: a.completedRevenueCents,
        payments: mine.map((p) => ({ kind: p.kind, amountCents: p.amountCents })),
      });
      const firstPayment = mine.find((p) => p.kind !== "refund");
      return {
        id: a.id,
        leadId: a.leadId,
        status: a.status,
        createdAt: a.createdAt,
        // Booked straight from the app or dashboard: confirmed when created.
        confirmedAt: confirm?.createdAt ?? (a.status !== "held" && a.source === "owner" && !events.some((e) => e.fromStatus === "held") ? a.createdAt : null),
        totalCents: balance.totalCents,
        collectedCents: balance.collectedCents,
        firstPaidAt: firstPayment?.createdAt ?? (balance.collectedCents > 0 ? a.updatedAt : null),
      };
    }),
  );
  return deriveConversions(leads, shaped);
}

/**
 * Report new or changed conversions to Google Ads. In `validate` mode Google
 * checks each request (validateOnly) and nothing is recorded or counted. Safe
 * to run repeatedly: sent conversions are skipped unless their value changed,
 * and Google deduplicates on the transaction id anyway.
 */
export async function uploadConversions(store: LeadStore, opts: { now?: Date; fetchImpl?: typeof fetch; config?: DataManagerConfig | null } = {}): Promise<UploadResult> {
  const cfg = opts.config === undefined ? dataManagerConfig() : opts.config;
  const { events, skipped } = await loadConversions(store);
  if (!cfg) return { mode: "unconfigured", planned: [], sent: 0, failed: [], skipped };

  const ledger = await store.listAdConversions();
  const plan = planUploads(events, ledger, enabledKinds(cfg));
  const result: UploadResult = {
    mode: cfg.mode,
    planned: plan.map((p) => ({ transactionId: p.event.transactionId, kind: p.event.kind, reason: p.reason, valueCents: p.event.valueCents })),
    sent: 0,
    failed: [],
    skipped,
  };
  if (plan.length === 0) return result;

  const validateOnly = cfg.mode !== "on";
  const token = await accessToken(cfg, opts.fetchImpl);
  const prior = new Map(ledger.map((r) => [r.transactionId, r]));
  const now = (opts.now ?? new Date()).toISOString();

  for (const { event } of plan) {
    const row = (status: AdConversionRecord["status"], extra: Partial<AdConversionRecord>): AdConversionRecord => ({
      ...ledgerFields(event),
      status,
      attempts: (prior.get(event.transactionId)?.attempts ?? 0) + 1,
      lastError: null,
      requestId: null,
      sentAt: prior.get(event.transactionId)?.sentAt ?? null,
      updatedAt: now,
      ...extra,
    });
    try {
      const requestId = await ingest(ingestBody(event, cfg, validateOnly), token, opts.fetchImpl);
      result.sent += 1;
      if (!validateOnly) await store.saveAdConversion(row("sent", { requestId, sentAt: now }));
    } catch (err) {
      const message = err instanceof DataManagerError ? err.message : "Upload failed";
      result.failed.push({ transactionId: event.transactionId, error: message });
      // A failed row is retried on the next run.
      if (!validateOnly) await store.saveAdConversion(row("failed", { lastError: message }));
    }
  }
  return result;
}

function ledgerFields(e: ConversionEvent) {
  return { transactionId: e.transactionId, kind: e.kind, leadId: e.leadId, appointmentId: e.appointmentId, valueCents: e.valueCents, eventAt: e.eventAt };
}
