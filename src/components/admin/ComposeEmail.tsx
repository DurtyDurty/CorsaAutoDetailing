"use client";

import { useActionState, useState } from "react";
import { sendLeadEmailAction, type SendEmailState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

/**
 * Write to a lead from the dashboard. Controlled fields so a failed send keeps
 * the draft; cleared after a successful send.
 */
export function ComposeEmail({
  leadId,
  firstName,
  to,
  from,
  defaultSubject,
  signature,
  initialSendKey,
}: {
  leadId: string;
  firstName: string;
  to: string;
  from: string;
  defaultSubject: string;
  signature: string;
  initialSendKey: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(`Hi ${firstName},\n\n`);
  const [state, formAction, pending] = useActionState(
    async (prev: SendEmailState, formData: FormData) => {
      const result = await sendLeadEmailAction(prev, formData);
      if (result.status === "sent") {
        setSubject(defaultSubject);
        setMessage(`Hi ${firstName},\n\n`);
      }
      return result;
    },
    { status: "idle", message: null, sendKey: initialSendKey },
  );

  return (
    <form action={formAction} className="border border-line bg-white rounded-md p-5 flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="sendKey" value={state.sendKey} />
      <div>
        <h2 className="font-medium">Email {firstName}</h2>
        <p className="text-xs text-ink-muted mt-1">
          From {from} to {to}. Replies come back to your inbox.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-subject" className="text-sm font-medium">
          Subject
        </label>
        <input
          id="email-subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          className="field"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="email-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={8000}
          required
          className="field min-h-44"
        />
        <p className="text-xs text-ink-muted whitespace-pre-line">Signed automatically:{"\n"}{signature}</p>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2"
              : "text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2"
          }
        >
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send email"}
        </Button>
      </div>
    </form>
  );
}
