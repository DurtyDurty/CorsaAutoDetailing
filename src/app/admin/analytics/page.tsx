import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { computeAnalytics, RANGE_LABELS, type AnalyticsRange } from "@/lib/owner/analytics";
import { BarList } from "@/components/admin/analytics/BarList";
import { ChartCard } from "@/components/admin/analytics/ChartCard";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import { StatTile } from "@/components/admin/analytics/StatTile";
import { compactUsd, fullUsd, pct } from "@/components/admin/analytics/format";
import { cn } from "@/lib/utils";

const RANGES = Object.keys(RANGE_LABELS) as AnalyticsRange[];

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const range: AnalyticsRange = RANGES.includes(sp.range as AnalyticsRange) ? (sp.range as AnalyticsRange) : "30d";

  const [a, counts] = await Promise.all([computeAnalytics(store, range), store.counts()]);

  const funnelTop = a.funnel[0]?.count ?? 0;
  const requestsTotal = a.sources.reduce((n, s) => n + s.count, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Analytics</h1>
          <p className="text-ink-muted text-sm mt-1">
            {counts.launchList} on the launch list · {counts.membershipInterest} interested in plans
          </p>
        </div>
        <a href="/admin/export" className="text-sm underline underline-offset-4">
          Export CSV
        </a>
      </div>

      {/* One filter row: the period scopes every number and chart below it. */}
      <nav aria-label="Period" className="flex flex-wrap gap-1 border border-line bg-white rounded-sm p-0.5 w-fit text-sm">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === "30d" ? "/admin/analytics" : `/admin/analytics?range=${r}`}
            aria-current={r === range ? "page" : undefined}
            className={cn("px-3 py-1.5 rounded-sm", r === range ? "bg-asphalt text-chalk" : "text-ink-muted hover:text-ink")}
          >
            {r === range && <span aria-hidden="true">✓ </span>}
            {RANGE_LABELS[r]}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="Booked revenue" value={compactUsd(a.bookedCents.value)} current={a.bookedCents.value} previous={a.bookedCents.previous} />
        <StatTile label="Collected" value={compactUsd(a.collectedCents.value)} current={a.collectedCents.value} previous={a.collectedCents.previous} />
        <StatTile label="Completed jobs" value={String(a.completedJobs.value)} current={a.completedJobs.value} previous={a.completedJobs.previous} />
        <StatTile
          label="Average ticket"
          value={a.avgTicketCents.value ? compactUsd(a.avgTicketCents.value) : "–"}
          current={a.avgTicketCents.value || null}
          previous={a.avgTicketCents.previous || null}
          note={a.completedJobs.value ? undefined : "After your first completed job"}
        />
        <StatTile
          label="Requests booked"
          value={a.conversion.rate === null ? "–" : pct(a.conversion.rate)}
          current={a.conversion.rate}
          previous={a.conversion.previous}
          format="percent-points"
          note={`${a.conversion.booked} of ${a.conversion.requests} requests`}
        />
        <StatTile
          label="Cancelled / no-show"
          value={a.lostRate.rate === null ? "–" : pct(a.lostRate.rate)}
          upIsGood={false}
          note={`${a.lostRate.lost} of ${a.lostRate.total} jobs`}
        />
      </dl>
      <p className="text-xs text-ink-muted -mt-5">
        {a.periodLabel}. Booked revenue is confirmed and completed jobs at their quoted price; collected is money recorded as paid. Next 7 days:{" "}
        <strong className="text-ink">{fullUsd(a.next7.cents)}</strong> across {a.next7.jobs} {a.next7.jobs === 1 ? "job" : "jobs"}.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Booked revenue by ${a.series.unit}`}
          subtitle={`${a.periodLabel}. The current ${a.series.unit} is in red.`}
          empty={a.series.points.every((p) => p.valueCents === 0)}
          emptyText="No booked jobs in this period yet. Revenue appears here as you confirm bookings."
          table={{ head: [a.series.unit === "week" ? "Week" : "Month", "Booked", "Jobs"], rows: a.series.points.map((p) => [p.title, fullUsd(p.valueCents), p.jobs]) }}
        >
          <ColumnChart columns={a.series.points} />
        </ChartCard>

        <ChartCard
          title="Booking funnel"
          subtitle="Website and app requests in this period, and how far they got."
          empty={funnelTop === 0}
          emptyText="No booking requests in this period yet."
          table={{ head: ["Stage", "Requests", "Share"], rows: a.funnel.map((f) => [f.label, f.count, funnelTop ? pct(f.count / funnelTop) : "–"]) }}
        >
          <BarList
            max={funnelTop}
            rows={a.funnel.map((f) => ({ label: f.label, value: f.count, display: String(f.count), detail: funnelTop ? `${pct(f.count / funnelTop)} of requests` : undefined }))}
          />
        </ChartCard>

        <ChartCard
          title="Service mix"
          subtitle="Booked jobs by package in this period."
          empty={a.services.length === 0}
          emptyText="No booked jobs in this period yet."
          table={{ head: ["Package", "Jobs", "Booked"], rows: a.services.map((s) => [s.label, s.count, fullUsd(s.cents ?? 0)]) }}
        >
          <BarList rows={a.services.map((s) => ({ label: s.label, value: s.count, display: `${s.count} · ${compactUsd(s.cents ?? 0)}` }))} />
        </ChartCard>

        <ChartCard
          title="Where requests come from"
          subtitle="Messages and booking requests in this period, by how the customer found you."
          empty={requestsTotal === 0}
          emptyText="No requests in this period yet."
          table={{ head: ["Source", "Requests", "Share"], rows: a.sources.map((s) => [s.label, s.count, pct(s.count / requestsTotal)]) }}
        >
          <BarList rows={a.sources.map((s) => ({ label: s.label, value: s.count, display: String(s.count), detail: `${pct(s.count / requestsTotal)} of requests` }))} />
        </ChartCard>
      </div>

    </div>
  );
}
