import { randomUUID } from "node:crypto";
import type { AppointmentStatus } from "@shared/appointment-status";
import { changeStatusAction } from "@/app/admin/jobs/actions";
import { ConfirmSubmit } from "./ConfirmSubmit";

/** One status change as a form. A fresh requestId per render makes a double-submit apply once. */
export function StepButton({
  id,
  to,
  label,
  back,
  confirm,
  reason,
  variant = "apex",
  size = "md",
  className,
}: {
  id: string;
  to: AppointmentStatus;
  label: string;
  back: string;
  confirm?: string;
  reason?: string;
  variant?: "primary" | "secondary" | "ghost" | "apex" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <form action={changeStatusAction} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      <input type="hidden" name="back" value={back} />
      {reason && <input type="hidden" name="reason" value={reason} />}
      <ConfirmSubmit variant={variant} size={size} confirm={confirm} className="w-full">
        {label}
      </ConfirmSubmit>
    </form>
  );
}