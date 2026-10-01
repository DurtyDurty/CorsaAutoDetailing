"use client";

import { deleteConversationAction } from "@/app/admin/inbox/actions";
import { Button } from "@/components/ui/Button";

/** Permanent delete, behind a browser confirmation. */
export function DeleteConversationForm({ leadId, name, disabled }: { leadId: string; name: string; disabled: boolean }) {
  return (
    <form
      action={deleteConversationAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Delete ${name}?\n\nThis permanently removes their requests, emails, replies and any past appointments. It can't be undone. To just tidy the Inbox, use Archive.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="confirm" value="delete" />
      <Button type="submit" variant="danger" size="sm" disabled={disabled}>
        Delete
      </Button>
    </form>
  );
}