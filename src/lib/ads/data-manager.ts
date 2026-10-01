import "server-only";
import type { ConversionEvent, ConversionKind } from "./conversions";

/**
 * Google Data Manager API client for reporting offline conversions to Google
 * Ads. Since June 15, 2026, new integrations can't upload click conversions
 * through the Google Ads API; the Data Manager API is the supported route
 * (https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events).
 *
 * Only ad click ids are sent: no names, emails or phone numbers, so there is
 * no hashing and no `encoding`. Each conversion goes in its own request
 * because the API rejects a whole request when one event is invalid.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const INGEST_URL = "https://datamanager.googleapis.com/v1/events:ingest";

export type UploadMode = "off" | "validate" | "on";

export interface DataManagerConfig {
  mode: UploadMode;
  /** Google Ads account that owns the conversion actions (digits only). */
  customerId: string;
  /** Manager account the credentials sign in through, if any (digits only). */
  loginCustomerId: string | null;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Conversion action ids ("Import from clicks") per kind; a kind without one isn't uploaded. */
  actions: Partial<Record<ConversionKind, string>>;
}

const digits = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

/** Read from the environment. Null when uploads are off or anything required is missing. */
export function dataManagerConfig(env: Record<string, string | undefined> = process.env): DataManagerConfig | null {
  const raw = (env.GOOGLE_ADS_CONVERSION_UPLOADS ?? "off").toLowerCase();
  const mode: UploadMode = raw === "on" || raw === "validate" ? raw : "off";
  const cfg = {
    mode,
    customerId: digits(env.GOOGLE_ADS_CUSTOMER_ID),
    loginCustomerId: digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) || null,
    clientId: env.GOOGLE_ADS_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    actions: {
      booking: digits(env.GOOGLE_ADS_CONVERSION_BOOKING) || undefined,
      paid: digits(env.GOOGLE_ADS_CONVERSION_PAID) || undefined,
      inquiry: digits(env.GOOGLE_ADS_CONVERSION_INQUIRY) || undefined,
    },
  };
  if (mode === "off" || !cfg.customerId || !cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) return null;
  return cfg;
}

export function enabledKinds(cfg: Pick<DataManagerConfig, "actions">): ConversionKind[] {
  return (Object.keys(cfg.actions) as ConversionKind[]).filter((k) => cfg.actions[k]);
}

/** The events:ingest body for one conversion. Pure, for tests and dry runs. */
export function ingestBody(event: ConversionEvent, cfg: Pick<DataManagerConfig, "customerId" | "loginCustomerId" | "actions">, validateOnly: boolean) {
  const action = cfg.actions[event.kind];
  if (!action) throw new Error(`No conversion action configured for ${event.kind}`);
  const adIdentifiers: Record<string, string> = {};
  if (event.click.gclid) adIdentifiers.gclid = event.click.gclid;
  if (event.click.gbraid) adIdentifiers.gbraid = event.click.gbraid;
  if (event.click.wbraid) adIdentifiers.wbraid = event.click.wbraid;
  return {
    destinations: [
      {
        operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.customerId },
        ...(cfg.loginCustomerId ? { loginAccount: { accountType: "GOOGLE_ADS", accountId: cfg.loginCustomerId } } : {}),
        productDestinationId: action,
      },
    ],
    events: [
      {
        transactionId: event.transactionId,
        eventTimestamp: new Date(event.eventAt).toISOString(),
        eventSource: "WEB",
        adIdentifiers,
        conversionValue: event.valueCents / 100,
        currency: "USD",
      },
    ],
    validateOnly,
  };
}

export class DataManagerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DataManagerError";
  }
}

type Fetch = typeof fetch;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Google error text without echoing request contents back into logs. */
async function errorText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { status?: string; message?: string } };
    return `${res.status} ${j.error?.status ?? ""} ${(j.error?.message ?? "").slice(0, 300)}`.trim();
  } catch {
    return `${res.status}`;
  }
}

export async function accessToken(cfg: Pick<DataManagerConfig, "clientId" | "clientSecret" | "refreshToken">, f: Fetch = fetch): Promise<string> {
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new DataManagerError(`OAuth token refresh failed: ${await errorText(res)}`, res.status, res.status >= 500);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new DataManagerError("OAuth token refresh returned no access token", 500, false);
  return j.access_token;
}

/** Send one ingest request; retries rate limits and server errors with backoff. Returns Google's requestId. */
export async function ingest(body: unknown, token: string, f: Fetch = fetch, attempts = 3): Promise<string | null> {
  for (let i = 1; ; i++) {
    const res = await f(INGEST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { requestId?: string };
      return j.requestId ?? null;
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i >= attempts) throw new DataManagerError(await errorText(res), res.status, retryable);
    await sleep(500 * 2 ** (i - 1));
  }
}
