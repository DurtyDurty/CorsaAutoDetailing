"use client";

import { useActionState, useState } from "react";
import { sendInboxEmailAction, type InboxSendState } from "@/app/admin/inbox/actions";
import { Button } from "@/components/ui/Button";

export interface RenderedTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

/**
 * Write to the customer. Templates fill subject and message for review. A
 * failed send keeps the draft; a successful one folds the composer away so
 * it's clear the email went.
 */
export function InboxComposer({
  leadId,
  firstName,
  to,
  defaultSubject,
  signature,
  templates,
  canSend,
  initialSendKey,
}: {
  leadId: string;
  firstName: string;
  to: string;
  defaultSubject: string;
  signature: string;
  templates: RenderedTemplate[];
  canSend: boolean;
  initialSendKey: string;
}) {
  const greeting = `Hi ${firstName},\n\n`;
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(greeting);
  const [collapsed, setCollapsed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: InboxSendState, formData: FormData) => {
      const result = await sendInboxEmailAction(prev, formData);
      if (result.status === "sent") {
        setSubject(defaultSubject);
        setMessage(greeting);
        setCollapsed(true);
      }
      return result;
    },
    { status: "idle", message: null, sendKey: initialSendKey },
  );

  if (collapsed && state.status === "sent") {
    return (
      <div className="border border-success/40 bg-[#eef6ef] rounded-md p-5 flex flex-wrap items-center justify-between gap-3" role="status">
        <p className="text-success font-medium">✓ {state.message === "Already sent." ? "Already sent" : "Sent"} to {to}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setCollapsed(false)}>
          Write another email
        </Button>
      </div>
    );
  }

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const typed = message.trim() !== greeting.trim();
    if (typed && !window.confirm("Replace your draft with this template?")) return;
    setSubject(t.subject);
    setMessage(t.body);
  };

  return (
    <form action={formAction} className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="sendKey" value={state.sendKey} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Email {firstName}</h2>
        {templates.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Template</span>
            <select
              className="field py-1.5 min-h-0 w-auto"
              value=""
              onChange={(e) => {
                applyTemplate(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Choose…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-xs text-ink-muted -mt-2">To {to}. Their reply comes back to this Inbox.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inbox-subject" className="text-sm font-medium">
          Subject
        </label>
        <input id="inbox-subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required className="field" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inbox-message" className="text-sm font-medium">
          Message
        </label>
        <textarea id="inbox-message" name="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={8000} required className="field min-h-44" />
        <p className="text-xs text-ink-muted whitespace-pre-line">Signed automatically:{"\n"}{signature}</p>
      </div>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
          {state.message}
        </p>
      )}
      {!canSend && <p className="text-sm text-error">Email isn&rsquo;t set up on the server, so sending is off.</p>}
      <div>
        <Button type="submit" disabled={pending || !canSend || message.trim() === greeting.trim()}>
          {pending ? "Sending…" : "Send email"}
        </Button>
      </div>
    </form>
  );
}