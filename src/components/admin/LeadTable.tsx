import Link from "next/link";
import { getService, getVehicleCategory } from "@/config/business";
import { LEAD_STAGE_LABELS, type LeadRecord } from "@/lib/leads/types";
import { formatEastern } from "@/lib/time";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<LeadRecord["leadType"], string> = {
  launch_list: "Launch list",
  quote_request: "Quote",
  membership_interest: "Plan interest",
  contact: "Contact",
};

export function StageBadge({ stage }: { stage: LeadRecord["stage"] }) {
  const tone: Record<LeadRecord["stage"], string> = {
    new: "bg-charcoal text-ivory",
    contacted: "bg-ivory-deep text-ink",
    quote_sent: "bg-champagne/40 text-ink",
    scheduled: "bg-[#dfeee2] text-success",
    completed: "bg-success text-white",
    lost: "bg-ivory-deep text-ink-muted",
    spam: "bg-[#fbeeeb] text-error",
  };
  return (
    <span className={cn("inline-block rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone[stage])}>
      {LEAD_STAGE_LABELS[stage]}
    </span>
  );
}

export function LeadTable({ leads, showType = true }: { leads: LeadRecord[]; showType?: boolean }) {
  if (leads.length === 0) {
    return <p className="text-ink-muted border border-line bg-white rounded-md p-6">Nothing here yet.</p>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-white rounded-md">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Received</th>
            <th className="px-4 py-3 font-medium">Name</th>
            {showType && <th className="px-4 py-3 font-medium">Type</th>}
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            <th className="px-4 py-3 font-medium">ZIP</th>
            <th className="px-4 py-3 font-medium">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {leads.map((l) => (
            <tr key={l.id} className={cn(l.archivedAt && "opacity-60")}>
              <td className="px-4 py-3 whitespace-nowrap">{formatEastern(l.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/leads/${l.id}`} className="font-medium underline underline-offset-4">
                  {[l.firstName, l.lastName].filter(Boolean).join(" ")}
                </Link>
                <span className="block text-ink-muted text-xs">{l.email}</span>
              </td>
              {showType && <td className="px-4 py-3 whitespace-nowrap">{TYPE_LABEL[l.leadType]}</td>}
              <td className="px-4 py-3">{l.serviceId ? (getService(l.serviceId)?.name ?? l.serviceId) : l.membershipCadence ? `Plan · ${l.membershipCadence}` : "—"}</td>
              <td className="px-4 py-3">
                {[l.vehicleYear, l.vehicleMake, l.vehicleModel].filter(Boolean).join(" ") ||
                  (l.vehicleCategory ? getVehicleCategory(l.vehicleCategory)?.label : "—")}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {l.zip ?? "—"}
                {l.zipEligibility && l.zipEligibility !== "core" && (
                  <span className="block text-xs text-ink-muted">{l.zipEligibility}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={l.stage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
