"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { changeTotalSchema, noteSchema, OVERRIDABLE, recordPaymentSchema, rescheduleSchema, sendQuoteSchema, statusChangeSchema } from "@shared/api";
import { formatCents } from "@shared/money";
import { requireOwner } from "@/lib/auth/owner";
import { ApiError } from "@/lib/api/http";
import { getLeadStore } from "@/lib/leads/store";
import { changeAppointmentStatus, getAppointmentDetail } from "@/lib/owner/appointments";
import { sendQuote } from "@/lib/quotes/service";
import { addNote, changeTotal, previewWorkConfirmation, recordPayment, rescheduleAppointment, sendReceipt, sendWorkConfirmation } from "@/lib/owner/work";

/**
 * Job actions for the web dashboard. Same services as the owner app, so a
 * change made here and one made on the phone follow identical rules. Each
 * form carries a requestId rendered with the page: a double-click or a
 * resubmitted form is applied once.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function store() {
  const s = await getLeadStore();
  if (!s) throw new Error("Lead store unavailable.");
  return s;
}

function jobId(formData: FormData): string {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/admin/calendar");
  return id;
}

/** Where to land afterwards: the page the form was on (dashboard paths only). */
function backTo(formData: FormData, id: string, msg: { ok?: string; error?: string; extra?: Record<string, string> }): never {
  const raw = String(formData.get("back") ?? "");
  const base = raw.startsWith("/admin") && !raw.startsWith("//") ? raw.split("?")[0]! : `/admin/jobs/${id}`;
  const q = new URLSearchParams({ ...(msg.extra ?? {}) });
  if (msg.ok) q.set("ok", msg.ok);
  if (msg.error) q.set("error", msg.error);
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/jobs/${id}`);
  redirect(`${base}${q.size ? `?${q}` : ""}`);
}

/** Runs a service call; turns its ApiError into a message on the page instead of an error screen. */
async function attempt<T>(formData: FormData, id: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      backTo(formData, id, { error: err.message, extra: err.fields?.override === OVERRIDABLE ? { canOverride: "1" } : undefined });
    }
    throw err;
  }
}

function parse<S extends z.ZodTypeAny>(formData: FormData, id: string, schema: S, raw: Record<string, unknown>): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) backTo(formData, id, { error: r.error.issues[0]?.message ?? "Some details need fixing." });
  return r.data;
}

const str = (formData: FormData, k: string) => {
  const v = formData.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

export async function changeStatusAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const input = parse(formData, id, statusChangeSchema, {
    to: str(formData, "to"),
    requestId: str(formData, "requestId"),
    reason: str(formData, "reason"),
    cancelledBy: str(formData, "cancelledBy"),
  });
  const res = await attempt(formData, id, async () => changeAppointmentStatus(await store(), owner.email, id, input));
  const email = res.customerEmail?.status === "sent" ? " The customer was emailed." : res.customerEmail?.status === "failed" ? ` The email to the customer didn't send: ${res.customerEmail.error}` : "";
  backTo(formData, id, { ok: `${res.unchanged ? "Already done." : "Updated."}${email}` });
}

export async function rescheduleAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const input = parse(formData, id, rescheduleSchema, {
    requestId: str(formData, "requestId"),
    date: str(formData, "date"),
    time: str(formData, "time"),
    durationMinutes: str(formData, "durationMinutes"),
    override: formData.get("override") === "on",
    notifyCustomer: formData.get("notifyCustomer") === "on",
  });
  const res = await attempt(formData, id, async () => rescheduleAppointment(await store(), owner.email, id, input));
  const email = res.customerEmail.status === "sent" ? " The customer was emailed the new time." : res.customerEmail.status === "failed" ? ` The email didn't send: ${res.customerEmail.error}` : "";
  backTo(formData, id, { ok: `Moved.${email}` });
}

export async function recordPaymentAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const dollars = Number(String(formData.get("amount") ?? "").replace(/[$,\s]/g, ""));
  const input = parse(formData, id, recordPaymentSchema, {
    requestId: str(formData, "requestId"),
    kind: str(formData, "kind") ?? "balance",
    method: str(formData, "method"),
    amountCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
    note: str(formData, "note"),
  });
  const res = await attempt(formData, id, async () => recordPayment(await store(), owner.email, id, input));
  backTo(formData, id, { ok: res.unchanged ? "Already recorded." : input.kind === "refund" ? "Refund recorded." : "Payment recorded." });
}

export async function changeTotalAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const amount = cents(formData.get("amount"));
  const input = parse(formData, id, changeTotalSchema, {
    requestId: str(formData, "requestId"),
    label: str(formData, "label") ?? "",
    amountCents: Number.isFinite(amount) ? (formData.get("direction") === "off" ? -Math.abs(amount) : Math.abs(amount)) : 0,
  });
  const res = await attempt(formData, id, async () => changeTotal(await store(), owner.email, id, input));
  backTo(formData, id, { ok: res.unchanged ? "Already changed." : `Total is now ${formatCents(res.appointment.balance.totalCents)}.` });
}

export async function receiptAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const requestId = str(formData, "requestId");
  if (!requestId || !UUID.test(requestId)) backTo(formData, id, { error: "Please reload the page and try again." });
  const res = await attempt(formData, id, async () => sendReceipt(await store(), owner.email, id, requestId));
  backTo(formData, id, res.customerEmail.status === "sent" || res.unchanged ? { ok: "Receipt sent." } : { error: `Receipt not sent: ${res.customerEmail.error}` });
}

export async function workConfirmationAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const requestId = str(formData, "requestId");
  if (!requestId || !UUID.test(requestId)) backTo(formData, id, { error: "Please reload the page and try again." });
  const res = await attempt(formData, id, async () => sendWorkConfirmation(await store(), owner.email, id, requestId));
  backTo(
    formData,
    id,
    res.customerEmail.status === "sent" || res.unchanged ? { ok: "Work confirmation sent to the customer." } : { error: `Work confirmation not sent: ${res.customerEmail.error}` },
  );
}

export async function previewConfirmationAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const res = await attempt(formData, id, async () => previewWorkConfirmation(await store(), owner.email, id));
  backTo(formData, id, { ok: `Preview sent to ${res.sentTo}. The customer was not emailed.` });
}

export async function noteAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const input = parse(formData, id, noteSchema, { requestId: str(formData, "requestId"), note: str(formData, "note") });
  await attempt(formData, id, async () => addNote(await store(), owner.email, id, input.requestId, input.note));
  backTo(formData, id, { ok: "Note saved." });
}

/** Dollars typed in a form field, as cents (blank = 0, junk = NaN so validation rejects it). */
function cents(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  return s === "" ? 0 : Math.round(Number(s) * 100);
}

export async function sendQuoteAction(formData: FormData) {
  const owner = await requireOwner();
  const id = jobId(formData);
  const rows = Math.min(Number(formData.get("rows")) || 0, 60);
  const lines: { label: string; amountCents: number }[] = [];
  for (let i = 0; i < rows; i++) {
    const label = String(formData.get(`label_${i}`) ?? "").trim();
    const amountCents = cents(formData.get(`amount_${i}`));
    // Every line the owner filled in; a completely blank one is skipped. A price with no description fails validation.
    const include = formData.get(`on_${i}`) === "on" || (formData.get(`custom_${i}`) === "1" && (label !== "" || amountCents !== 0));
    if (include) lines.push({ label, amountCents });
  }
  const input = parse(formData, id, sendQuoteSchema, {
    requestId: str(formData, "requestId"),
    lines,
    discountCents: cents(formData.get("discount")),
    notes: str(formData, "notes"),
    expiresInDays: str(formData, "expiresInDays"),
    arrivalTime: str(formData, "arrivalTime"),
  });
  const res = await attempt(formData, id, async () => sendQuote(await store(), owner.email, id, input, getAppointmentDetail));
  backTo(
    formData,
    id,
    res.customerEmail.status === "failed"
      ? { error: `Quote ${res.quote.number} saved, but the email didn't send: ${res.customerEmail.error}` }
      : { ok: res.unchanged ? "Already sent." : `Quote ${res.quote.number} sent. Waiting on the customer to accept it.` },
  );
}
