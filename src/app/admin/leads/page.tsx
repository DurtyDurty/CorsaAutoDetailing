import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads/types";
import { LeadTable } from "@/components/admin/LeadTable";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Leads" };

/** Every website request and message, with search and stage filters. */
export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const stage = typeof sp.stage === "string" && (LEAD_STAGES as readonly string[]).includes(sp.stage) ? (sp.stage as LeadStage) : undefined;
  const archived = sp.archived === "1";
  const leads = await store.listLeads({ leadType: ["quote_request", "contact"], search: search || undefined, stage, includeArchived: archived, limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">Leads</h1>
        <a href="/admin/export" className="text-sm underline underline-offset-4">
          Export CSV
        </a>
      </div>
      {typeof sp.ok === "string" && (
        <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
          {sp.ok}
        </p>
      )}
      <form method="get" className="flex flex-wrap gap-3 items-end" role="search">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium">
            Search
          </label>
          <input id="q" name="q" defaultValue={search} className="field min-h-10 py-2" placeholder="Name, email, vehicle, ZIP" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="stage" className="text-xs font-medium">
            Stage
          </label>
          <select id="stage" name="stage" defaultValue={stage ?? ""} className="field min-h-10 py-2">
            <option value="">All</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm min-h-10">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} className="checkbox" />
          Include archived
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {(search || stage || archived) && (
          <Link href="/admin/leads" className="text-sm underline underline-offset-4 min-h-10 inline-flex items-center">
            Clear
          </Link>
        )}
      </form>
      <LeadTable leads={leads} />
    </div>
  );
}