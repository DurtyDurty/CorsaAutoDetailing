/**
 * Appointment status rules, shared by the website, the owner API and the
 * mobile app. Pure TypeScript: no Node, Next or React Native imports.
 *
 * Lifecycle: (request = a lead, no appointment yet) → held (waiting on a quote)
 * → confirmed → en_route → arrived → in_progress → completed. "Paid" is not a
 * status: it's derived from the payments ledger (see money.ts).
 */

export const APPOINTMENT_STATUSES = [
  "held",
  "confirmed",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "declined",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  held: "To confirm",
  confirmed: "Confirmed",
  en_route: "En route",
  arrived: "Arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  declined: "Declined",
};

/**
 * The label to show for a job. A held time is waiting on a quote (deposits are
 * off), so it says where the quote stands: still to send, or sent and waiting
 * on the customer. `quoteStatus` is the latest quote's QuoteViewStatus.
 */
export function statusLabel(status: AppointmentStatus, quoteStatus?: string | null): string {
  if (status !== "held") return APPOINTMENT_STATUS_LABELS[status];
  switch (quoteStatus) {
    case "sent":
      return "Quote sent · waiting on customer";
    case "expired":
      return "Quote expired";
    case "declined":
      return "Quote declined";
    default:
      return "Needs a quote";
  }
}

/** Statuses that occupy calendar time (with the travel buffer). Mirrors the database exclusion constraint. */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ["held", "confirmed", "en_route", "arrived", "in_progress"];

export function isBlocking(status: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}

/** The job is underway in the field (owner has left for it or is there). */
export const FIELD_STATUSES: readonly AppointmentStatus[] = ["en_route", "arrived", "in_progress"];

export const TERMINAL_STATUSES: readonly AppointmentStatus[] = ["completed", "cancelled", "no_show", "declined"];

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  held: ["confirmed", "declined", "cancelled"],
  confirmed: ["en_route", "arrived", "in_progress", "completed", "cancelled", "no_show"],
  // Back to confirmed undoes an accidental "en route".
  en_route: ["arrived", "confirmed", "cancelled", "no_show"],
  arrived: ["in_progress", "completed", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
  declined: [],
};

export function allowedTransitions(from: AppointmentStatus): readonly AppointmentStatus[] {
  return TRANSITIONS[from];
}

export type TransitionCheck =
  | { ok: true; noop: boolean }
  | { ok: false; reason: string };

/**
 * Whether `from → to` is allowed. Asking for the status it already has is a
 * no-op success, so a repeated tap or a retried request changes nothing.
 */
export function checkTransition(from: AppointmentStatus, to: AppointmentStatus): TransitionCheck {
  if (from === to) return { ok: true, noop: true };
  if (TRANSITIONS[from].includes(to)) return { ok: true, noop: false };
  return {
    ok: false,
    reason: `Can't change an appointment from ${APPOINTMENT_STATUS_LABELS[from]} to ${APPOINTMENT_STATUS_LABELS[to]}.`,
  };
}

/** Transitions that need a reason recorded with them. */
export function requiresReason(to: AppointmentStatus): boolean {
  return to === "cancelled" || to === "declined" || to === "no_show";
}

export type CancelledBy = "customer" | "owner";
