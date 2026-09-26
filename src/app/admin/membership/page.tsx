import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LeadTable } from "@/components/admin/LeadTable";

export default async function MembershipInterestPage() {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const leads = await store.listLeads({ leadType: "membership_interest", limit: 500 });
  const byCadence = leads.reduce<Record<string, number>>((acc, l) => {
    const k = l.membershipCadence ?? "unspecified";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Maintenance-plan interest</h1>
          <p className="text-ink-muted text-sm mt-1">
            {leads.length} responses ·{" "}
            {Object.entries(byCadence)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </p>
        </div>
        <a href="/admin/export?type=membership_interest" className="text-sm underline underline-offset-4">
          Export CSV
        </a>
      </div>
      <LeadTable leads={leads} showType={false} />
    </div>
  );
}
