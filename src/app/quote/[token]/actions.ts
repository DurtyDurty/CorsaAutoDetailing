"use server";

import { redirect } from "next/navigation";
import { getLeadStore } from "@/lib/leads/store";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { acceptQuote, declineQuote, isQuoteToken } from "@/lib/quotes/service";

/**
 * The customer's answer to a quote. The private token is the only key. Results
 * come back as fixed codes in the URL; the page reads the quote's real state.
 */

async function tokenFrom(formData: FormData): Promise<string> {
  const token = String(formData.get("token") ?? "");
  if (!isQuoteToken(token)) redirect("/");
  if (!checkRateLimit(await clientKey("quote-answer"), 10, 10 * 60_000).ok) redirect(`/quote/${token}?e=busy`);
  return token;
}

export async function acceptQuoteAction(formData: FormData) {
  const token = await tokenFrom(formData);
  if (formData.get("agree") !== "on") redirect(`/quote/${token}?e=agree`);
  const store = await getLeadStore();
  if (!store) redirect(`/quote/${token}?e=unavailable`);
  const res = await acceptQuote(store, token);
  redirect(`/quote/${token}${res.ok ? "?done=accepted" : ""}`);
}

export async function declineQuoteAction(formData: FormData) {
  const token = await tokenFrom(formData);
  const store = await getLeadStore();
  if (!store) redirect(`/quote/${token}?e=unavailable`);
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  const res = await declineQuote(store, token, reason || null);
  redirect(`/quote/${token}${res.ok ? "?done=declined" : ""}`);
}
