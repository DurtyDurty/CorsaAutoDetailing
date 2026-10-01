import type { AppointmentStatus } from "@shared/appointment-status";

export interface NextStep {
  to: AppointmentStatus;
  label: string;
  /** Ask before applying (it ends the job or can't easily be undone). */
  confirm?: { title: string; message: string };
}

/** The single most likely next action for a job, used for the big button on Today. */
export function nextStep(status: AppointmentStatus): NextStep | null {
  switch (status) {
    case "held":
      return { to: "confirmed", label: "Confirm booking" };
    case "confirmed":
      return { to: "en_route", label: "Mark en route" };
    case "en_route":
      return { to: "arrived", label: "Mark arrived" };
    case "arrived":
      return { to: "in_progress", label: "Start service" };
    case "in_progress":
      return {
        to: "completed",
        label: "Complete service",
        confirm: { title: "Mark this job complete?", message: "You can still record payment afterwards." },
      };
    default:
      return null;
  }
}