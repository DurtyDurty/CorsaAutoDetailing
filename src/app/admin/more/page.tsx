import type { Metadata } from "next";
import Link from "next/link";
import { getOwnerSession, requireOwner } from "@/lib/auth/owner";

export const metadata: Metadata = { title: "More" };

const LINKS = [
  { href: "/admin/leads", label: "Leads", detail: "Every website request and message, with search and filters." },

  { href: "/admin/time-off", label: "Days off", detail: "Block days so the website calendar won't offer them." },
  { href: "/admin/export", label: "Export CSV", detail: "Download every lead as a spreadsheet." },
];

/** Everything that isn't a daily screen, like the app's More tab. */
export default async function MorePage() {
  await requireOwner();
  const session = await getOwnerSession();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="font-display text-3xl">More</h1>
      <div className="border border-line bg-white rounded-md p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Signed in as</p>
        <p className="font-medium mt-1">{session?.email}</p>

      </div>
      <ul className="border border-line bg-white rounded-md divide-y divide-line">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-chalk">
              <span>
                <span className="block font-medium">{l.label}</span>
                <span className="block text-sm text-ink-muted">{l.detail}</span>
              </span>
              <span aria-hidden="true" className="text-ink-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}