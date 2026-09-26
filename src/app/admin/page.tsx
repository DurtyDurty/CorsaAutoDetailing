import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads/types";
import { LeadTable } from "@/components/admin/LeadTable";
import { formatUsd } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const stage = typeof sp.stage === "string" && (LEAD_STAGES as readonly string[]).includes(sp.stage) ? (sp.stage as LeadStage) : undefined;
  const archived = sp.archived === "1";

  const [counts, leads] = await Promise.all([
    store.counts(),
    store.listLeads({ leadType: ["quote_request", "contact"], search: search || undefined, stage, includeArchived: archived, limit: 200 }),
  ]);

  const tiles = [
    { label: "Leads", value: counts.leads },
    { label: "Contacted", value: counts.contacted },
    { label: "Quotes", value: counts.quotes },
    { label: "Confirmed appts", value: counts.confirmedAppointments },
    { label: "Completed jobs", value: counts.completedJobs },
    { label: "Recorded revenue", value: formatUsd(counts.recordedRevenueCents / 100) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-ink-muted text-sm mt-1">
            {counts.launchList} on the launch list · {counts.membershipInterest} interested in plans
          </p>
        </div>
        <a href="/admin/export" className="text-sm underline underline-offset-4">
          Export CSV
        </a>
      </div>

      {typeof sp.ok === "string" && (
        <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
          {sp.ok}
        </p>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="border border-line bg-white rounded-md px-4 py-3">
            <dt className="text-xs text-ink-muted">{t.label}</dt>
            <dd className="font-display text-2xl mt-1">{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-muted -mt-5">Revenue counts only completed jobs you&rsquo;ve recorded. Leads and quotes are never counted as revenue.</p>

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
          <Link href="/admin" className="text-sm underline underline-offset-4 min-h-10 inline-flex items-center">
            Clear
          </Link>
        )}
      </form>

      <LeadTable leads={leads} />
    </div>
  );
}
