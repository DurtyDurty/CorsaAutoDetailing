/**
 * Reusable customer emails. The owner always reviews and edits before
 * sending; the server appends the signature. Wording states only what the
 * business actually does (no review links, refunds or fees that aren't set).
 */

export interface TemplateFields {
  firstName: string;
  businessName: string;
  serviceName: string | null;
  /** Already formatted for the reader, e.g. "Friday, October 9". */
  date: string | null;
  time: string | null;
  balance: string | null;
  /** Set for first-time offer signups only. */
  offerPercent: number | null;
  offerUrl: string | null;
}

export type TemplateNeed = "appointment" | "balance" | "offer";

export interface EmailTemplate {
  id: string;
  label: string;
  needs: TemplateNeed[];
  subject: (f: TemplateFields) => string;
  body: (f: TemplateFields) => string;
}

const service = (f: TemplateFields) => f.serviceName ?? "detail";
const when = (f: TemplateFields) => [f.date, f.time ? `at ${f.time}` : null].filter(Boolean).join(" ");

const percent = (f: TemplateFields) => `${f.offerPercent ?? 10}%`;

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // First-time offer signups leave only a first name and email, so these ask for what a quote needs.
  {
    id: "offer_follow_up",
    label: "Offer: follow-up",
    needs: ["offer"],
    subject: () => "Your first detail",
    body: (f) =>
      `Hi ${f.firstName},\n\nThanks for signing up for ${percent(f)} off your first detail. I wanted to follow up myself in case you have any questions.\n\nI come to your home or work, and you don't need to have water or power for me. You can see the packages and book here, with the discount already applied:\n${f.offerUrl ?? ""}\n\nOr just reply with what you drive and a day that works for you, and I'll take it from there.`,
  },
  {
    id: "offer_vehicle",
    label: "Offer: ask about the car",
    needs: ["offer"],
    subject: () => "Quick question about your car",
    body: (f) =>
      `Hi ${f.firstName},\n\nSo I can give you a price with your ${percent(f)} off, what are you driving (year, make and model)? And is there anything I should know before I come out, like a lot of pet hair or sand?\n\nAlso, where would I be coming to? A town or ZIP code is enough for now.`,
  },
  {
    id: "offer_check_in",
    label: "Offer: last check-in",
    needs: ["offer"],
    subject: (f) => `Still want your ${percent(f)} off?`,
    body: (f) =>
      `Hi ${f.firstName},\n\nChecking in one last time. Your ${percent(f)} off your first detail is still good whenever your car's ready for a cleaning:\n${f.offerUrl ?? ""}\n\nIf now isn't a good time, no problem. I won't keep emailing you about it.`,
  },
  {
    id: "booking_received",
    label: "Request received",
    needs: [],
    subject: (f) => `We received your ${service(f)} request`,
    body: (f) =>
      `Hi ${f.firstName},\n\nThanks for reaching out to ${f.businessName}. We received your request for the ${service(f)} and will reply shortly with a quote and available times.`,
  },
  {
    id: "appointment_confirmed",
    label: "Appointment confirmed",
    needs: ["appointment"],
    subject: (f) => `Your ${service(f)} is confirmed for ${f.date ?? "your appointment"}`,
    body: (f) =>
      `Hi ${f.firstName},\n\nYou're booked for the ${service(f)} on ${when(f)}. If anything changes, just reply to this email.`,
  },
  {
    id: "reminder",
    label: "Reminder",
    needs: ["appointment"],
    subject: (f) => `Reminder: your ${service(f)} on ${f.date ?? "your appointment day"}`,
    body: (f) => `Hi ${f.firstName},\n\nA quick reminder that we'll see you on ${when(f)} for your ${service(f)}.`,
  },
  {
    id: "en_route",
    label: "On my way",
    needs: [],
    subject: () => "On my way",
    body: (f) => `Hi ${f.firstName},\n\nI'm on my way to you now for your ${service(f)}.`,
  },
  {
    id: "arrived",
    label: "I've arrived",
    needs: [],
    subject: () => "I've arrived",
    body: (f) => `Hi ${f.firstName},\n\nI've arrived and I'm getting set up for your ${service(f)}.`,
  },
  {
    id: "completed",
    label: "Service completed",
    needs: [],
    subject: (f) => `Your ${service(f)} is complete`,
    body: (f) => `Hi ${f.firstName},\n\nYour ${service(f)} is done. Thank you for choosing ${f.businessName}!`,
  },
  {
    id: "payment_reminder",
    label: "Payment reminder",
    needs: ["appointment", "balance"],
    subject: (f) => `Balance for your ${service(f)}`,
    body: (f) =>
      `Hi ${f.firstName},\n\nA friendly reminder that ${f.balance ?? "a balance"} is still due for your ${service(f)} on ${f.date ?? "your appointment"}. We accept card, cash and digital payments.`,
  },
  {
    id: "weather",
    label: "Weather reschedule",
    needs: ["appointment"],
    subject: () => "Rescheduling for the weather",
    body: (f) =>
      `Hi ${f.firstName},\n\nThe forecast for ${f.date ?? "your appointment day"} doesn't look good for your ${service(f)}. We reschedule weather delays at no charge. Reply with a few days and times that work for you.`,
  },
  {
    id: "follow_up",
    label: "Follow-up",
    needs: [],
    subject: () => "How did your detail turn out?",
    body: (f) =>
      `Hi ${f.firstName},\n\nThank you again for choosing ${f.businessName}. If you have a moment, I'd love to hear how your ${service(f)} turned out. Just reply to this email.`,
  },
];

/** Templates whose details are available for this customer. */
export function availableTemplates(has: { appointment: boolean; balance: boolean; offer: boolean }): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter((t) => t.needs.every((n) => has[n]));
}