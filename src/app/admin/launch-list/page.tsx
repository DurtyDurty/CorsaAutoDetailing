import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LeadTable } from "@/components/admin/LeadTable";

export default async function LaunchListPage() {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const leads = await store.listLeads({ leadType: "launch_list", limit: 500 });
  const optedIn = leads.filter((l) => l.consent.marketingEmail).length;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Launch list</h1>
          <p className="text-ink-muted text-sm mt-1">
            {leads.length} signups · {optedIn} opted into marketing email
          </p>
        </div>
        <a href="/admin/export?type=launch_list" className="text-sm underline underline-offset-4">
          Export CSV
        </a>
      </div>
      <LeadTable leads={leads} showType={false} />
    </div>
  );
}
