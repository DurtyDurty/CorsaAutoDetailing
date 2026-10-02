import "server-only";
import { accessToken } from "./data-manager";

/**
 * Google Ads spend for the dashboard, read with a single GAQL report request
 * (read-only). Returns null when Google Ads isn't connected or the request
 * fails, so the dashboard says "not connected" instead of showing a guess.
 */

export const GOOGLE_ADS_API_VERSION = "v25";

export interface AdSpend {
  costCents: number;
  clicks: number;
  impressions: number;
}

const digits = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

export function spendConfigured(env: Record<string, string | undefined> = process.env): boolean {
  // Developer tokens were retired on 2026-09-09 (access now belongs to the Cloud project); one is sent only if set.
  return Boolean(digits(env.GOOGLE_ADS_CUSTOMER_ID) && env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET && env.GOOGLE_ADS_REFRESH_TOKEN);
}

/** from/to are Eastern dates (YYYY-MM-DD), inclusive; the account's own time zone applies to the report. */
export async function fetchAdSpend(from: string, to: string, env: Record<string, string | undefined> = process.env, f: typeof fetch = fetch): Promise<AdSpend | null> {
  if (!spendConfigured(env) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const customerId = digits(env.GOOGLE_ADS_CUSTOMER_ID);
  const login = digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  try {
    const token = await accessToken(
      { clientId: env.GOOGLE_ADS_CLIENT_ID!, clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!, refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN! },
      f,
    );
    const res = await f(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(env.GOOGLE_ADS_DEVELOPER_TOKEN ? { "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN } : {}),
        ...(login ? { "login-customer-id": login } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[ads-spend] report failed:", res.status);
      return null;
    }
    const j = (await res.json()) as { results?: { metrics?: { costMicros?: string; clicks?: string; impressions?: string } }[] };
    const rows = j.results ?? [];
    const total = (k: "costMicros" | "clicks" | "impressions") => rows.reduce((n, r) => n + Number(r.metrics?.[k] ?? 0), 0);
    return { costCents: Math.round(total("costMicros") / 10_000), clicks: total("clicks"), impressions: total("impressions") };
  } catch (err) {
    console.error("[ads-spend]", err instanceof Error ? err.message : "failed");
    return null;
  }
}
