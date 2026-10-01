import type { AppointmentStatus } from "@shared/appointment-status";
import { nextStep } from "@shared/next-step";

/** The shared next step, with its confirmation as one browser-dialog line. */
export function nextStepFor(status: AppointmentStatus): { to: AppointmentStatus; label: string; confirm?: string } | null {
  const s = nextStep(status);
  return s ? { to: s.to, label: s.label, confirm: s.confirm ? `${s.confirm.title} ${s.confirm.message}` : undefined } : null;
}