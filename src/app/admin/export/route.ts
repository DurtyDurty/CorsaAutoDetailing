import { NextResponse, type NextRequest } from "next/server";
import { ownerOrNull } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import type { LeadType } from "@/lib/leads/types";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const TYPES: LeadType[] = ["launch_list", "quote_request", "membership_interest", "contact"];

/** CSV export. Authorization enforced here, not just by hiding the link. */
export async function GET(req: NextRequest) {
  if (!(await ownerOrNull())) return new NextResponse("Unauthorized", { status: 401 });
  const store = await getLeadStore();
  if (!store) return new NextResponse("Lead store unavailable", { status: 503 });

  const typeParam = req.nextUrl.searchParams.get("type");
  const leadType = TYPES.includes(typeParam as LeadType) ? (typeParam as LeadType) : undefined;
  const leads = await store.listLeads({ leadType, includeArchived: true, limit: 5000 });

  const headers = [
    "id", "created_at", "lead_type", "business_mode", "stage", "first_name", "last_name", "email", "phone",
    "preferred_contact", "service", "vehicle_category", "vehicle_year", "vehicle_make", "vehicle_model",
    "condition", "condition_flags", "zip", "zip_eligibility", "city", "service_address", "location_type", "time_windows",
    "preferred_date", "estimate_total", "pricing_version", "price_acknowledged_at", "marketing_email", "membership_cadence",
    "future_interests", "follow_up_on", "archived_at", "landing_path", "utm_source", "utm_medium", "utm_campaign",
  ];
  const rows = leads.map((l) => [
    l.id, l.createdAt, l.leadType, l.businessMode, l.stage, l.firstName, l.lastName, l.email, l.phone,
    l.preferredContact, l.serviceId, l.vehicleCategory, l.vehicleYear, l.vehicleMake, l.vehicleModel,
    l.condition, l.conditionFlags, l.zip, l.zipEligibility, l.city, l.serviceAddress, l.locationType, l.timeWindows,
    l.preferredDate, l.estimate?.total ?? "", l.pricingVersion, l.consent.priceAcknowledgedAt ?? "", l.consent.marketingEmail, l.membershipCadence,
    l.futureInterests, l.followUpOn, l.archivedAt, l.source.landingPath, l.source.utmSource, l.source.utmMedium, l.source.utmCampaign,
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="corsa-leads-${leadType ?? "all"}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
