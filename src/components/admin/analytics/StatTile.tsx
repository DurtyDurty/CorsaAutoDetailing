import { cn } from "@/lib/utils";

/**
 * Label, value, and the change against the previous period. The arrow and the
 * word carry direction; color only reinforces it (and knows when "up" is bad).
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  note,
  format = "number",
}: {
  label: string;
  value: string;
  current?: number | null;
  previous?: number | null;
  upIsGood?: boolean;
  note?: string;
  format?: "number" | "percent-points";
}) {
  let delta: { text: string; good: boolean | null } | null = null;
  if (current !== undefined && current !== null && previous !== undefined && previous !== null) {
    if (format === "percent-points") {
      const pts = Math.round((current - previous) * 100);
      delta = pts === 0 ? { text: "No change", good: null } : { text: `${pts > 0 ? "▲" : "▼"} ${Math.abs(pts)} pts`, good: pts > 0 === upIsGood };
    } else if (previous === 0) {
      delta = current === 0 ? { text: "No change", good: null } : { text: "▲ New", good: upIsGood };
    } else {
      const change = Math.round(((current - previous) / previous) * 100);
      delta = change === 0 ? { text: "No change", good: null } : { text: `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}%`, good: change > 0 === upIsGood };
    }
  }
  return (
    <div className="border border-line bg-white rounded-md px-4 py-3 flex flex-col gap-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-2xl font-semibold leading-tight">{value}</dd>
      {delta && (
        <dd className={cn("text-xs font-medium", delta.good === null ? "text-ink-muted" : delta.good ? "text-success" : "text-error")}>
          {delta.text} <span className="text-ink-muted font-normal">vs previous period</span>
        </dd>
      )}
      {note && <dd className="text-xs text-ink-muted">{note}</dd>}
    </div>
  );
}