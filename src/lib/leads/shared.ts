import type { AppointmentRecord, DashboardCounts, LeadFilter, LeadRecord } from "./types";

export function matchesFilter(lead: LeadRecord, filter: LeadFilter): boolean {
  if (!filter.includeArchived && lead.archivedAt) return false;
  if (filter.leadType) {
    const types = Array.isArray(filter.leadType) ? filter.leadType : [filter.leadType];
    if (!types.includes(lead.leadType)) return false;
  }
  if (filter.stage && lead.stage !== filter.stage) return false;
  if (filter.search) {
    const q = filter.search.toLowerCase();
    const hay = [
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.vehicleMake,
      lead.vehicleModel,
      lead.zip,
      lead.city,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function computeCounts(leads: LeadRecord[], appointments: AppointmentRecord[]): DashboardCounts {
  const active = leads.filter((l) => !l.archivedAt);
  const isLead = (l: LeadRecord) => l.leadType === "quote_request" || l.leadType === "contact";
  return {
    leads: active.filter(isLead).length,
    contacted: active.filter((l) => isLead(l) && l.stage !== "new" && l.stage !== "spam").length,
    quotes: active.filter((l) => l.stage === "quote_sent" || l.stage === "scheduled" || l.stage === "completed").length,
    confirmedAppointments: appointments.filter((a) => a.status === "confirmed").length,
    completedJobs: appointments.filter((a) => a.status === "completed").length,
    recordedRevenueCents: appointments
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + (a.completedRevenueCents ?? 0), 0),
    launchList: active.filter((l) => l.leadType === "launch_list").length,
    membershipInterest: active.filter((l) => l.leadType === "membership_interest").length,
  };
}
