"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { ApiError } from "@/lib/api/http";
import { deleteConversation, markHandled, setArchived } from "@/lib/owner/conversations";
import { sendOwnerEmail } from "@/lib/owner/email";
import { cleanText } from "@/lib/utils";

/**
 * Dashboard Inbox actions. Same services as the owner app's API, so the web
 * dashboard and the phone always agree. Every action re-checks the owner.
 */

async function store() {
  const s = await getLeadStore();
  if (!s) throw new Error("Lead store unavailable.");
  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function leadIdFrom(formData: FormData): string {
  const id = String(formData.get("leadId") ?? "");
  if (!UUID.test(id)) redirect("/admin/inbox");
  return id;
}

function refresh(leadId: string) {
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/inbox/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
}

export interface InboxSendState {
  status: "idle" | "sent" | "error";
  message: string | null;
  /** Key for the next send; a new one after every definite outcome. */
  sendKey: string;
}

export async function sendInboxEmailAction(prev: InboxSendState, formData: FormData): Promise<InboxSendState> {
  await requireOwner();
  const leadId = leadIdFrom(formData);
  const sendKey = String(formData.get("sendKey") ?? "");
  const subject = cleanText(formData.get("subject"), 200).replace(/\s+/g, " ");
  const message = cleanText(formData.get("message"), 8000);
  if (!UUID.test(sendKey)) return { status: "error", message: "Please reload the page and try again.", sendKey: randomUUID() };
  if (!subject) return { ...prev, status: "error", message: "Add a subject." };
  if (!message) return { ...prev, status: "error", message: "Write a message first." };

  const result = await sendOwnerEmail(await store(), leadId, { subject, message, sendKey });
  refresh(leadId);
  if (result.status === "sent") {
    return { status: "sent", message: result.alreadySent ? "Already sent." : "Sent.", sendKey: randomUUID() };
  }
  const reason = result.status === "not_found" ? "Customer not found." : result.reason;
  return { status: "error", message: `Not sent: ${reason}`, sendKey: randomUUID() };
}

export async function markHandledAction(formData: FormData) {
  await requireOwner();
  const leadId = leadIdFrom(formData);
  await markHandled(await store(), leadId);
  refresh(leadId);
  redirect(`/admin/inbox/${leadId}`);
}

export async function archiveAction(formData: FormData) {
  await requireOwner();
  const leadId = leadIdFrom(formData);
  const archived = formData.get("archived") === "1";
  await setArchived(await store(), leadId, archived);
  refresh(leadId);
  // Archiving tidies it away; restoring keeps it open.
  redirect(archived ? "/admin/inbox?ok=Archived" : `/admin/inbox/${leadId}`);
}

export async function deleteConversationAction(formData: FormData) {
  await requireOwner();
  const leadId = leadIdFrom(formData);
  if (formData.get("confirm") !== "delete") redirect(`/admin/inbox/${leadId}?error=${encodeURIComponent("Confirm the delete first.")}`);
  try {
    await deleteConversation(await store(), leadId);
  } catch (err) {
    if (err instanceof ApiError) redirect(`/admin/inbox/${leadId}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
  redirect("/admin/inbox?ok=Deleted");
}
