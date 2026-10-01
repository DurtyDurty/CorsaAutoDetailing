import type { ReactNode } from "react";

/** Card chrome: title, one-line subtitle, the chart, and a table view that never needs hover. */
export function ChartCard({
  title,
  subtitle,
  empty,
  emptyText,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  empty: boolean;
  emptyText: string;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-white rounded-md p-5 flex flex-col gap-4 min-w-0" aria-label={title}>
      <header>
        <h2 className="font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
      </header>
      {empty ? (
        <p className="text-sm text-ink-muted border border-dashed border-line rounded-sm px-4 py-8 text-center">{emptyText}</p>
      ) : (
        <>
          {children}
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink w-fit">Show as table</summary>
            <table className="mt-2 w-full text-left [font-variant-numeric:tabular-nums]">
              <thead>
                <tr className="text-xs text-ink-muted">
                  {table.head.map((h, i) => (
                    <th key={h} className={i === 0 ? "py-1 font-medium" : "py-1 font-medium text-right"}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r) => (
                  <tr key={String(r[0])}>
                    {r.map((c, i) => (
                      <td key={i} className={i === 0 ? "py-1.5" : "py-1.5 text-right"}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}