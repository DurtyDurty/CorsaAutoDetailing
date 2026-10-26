import "server-only";
import { business } from "@/config/business";
import { getEmailAdapter } from "@/lib/email";
import type { LeadStore, NewSiteError } from "@/lib/leads/types";

/** Owner alerts for a broken form: at most one per this long per server instance, so an outage isn't an email flood. */
const ALERT_EVERY_MS = 15 * 60_000;
let lastAlertAt = 0;

/**
 * Record a form that failed or was turned away, for the dashboard (and Vercel
 * logs). Never throws. When a request couldn't be saved or the server errored,
 * the owner is also emailed, because the database may be what is down.
 * Callers pass field names and error text only, never what the visitor typed.
 */
export async function reportFormFailure(store: LeadStore | null, input: NewSiteError): Promise<void> {
  console.error(`[form:${input.form}] ${input.kind}: ${input.detail}`);
  if (store) {
    try {
      await store.logSiteError(input);
    } catch (err) {
      console.error("[site-errors] not logged:", err instanceof Error ? err.message : err);
    }
  }
  if (input.kind === "invalid" || Date.now() - lastAlertAt < ALERT_EVERY_MS) return;

  const to = process.env.OWNER_NOTIFY_EMAIL;
  const email = getEmailAdapter();
  if (!to || email.kind === "disabled") return;
  lastAlertAt = Date.now();
  try {
    await email.send({
      to,
      subject: `[${business.brand.shortName}] Website form problem: a customer's request may not have been saved`,
      text: [
        `The ${input.form} form failed on the website (${input.kind === "save_failed" ? "the request could not be saved" : "server error"}).`,
        "",
        `Error: ${input.detail}`,
        "",
        "The customer was shown your phone number and asked to call or text. Check the dashboard for details:",
        `${business.brand.canonicalDomain}/admin`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[site-errors] owner alert failed:", err instanceof Error ? err.message : err);
  }
}
