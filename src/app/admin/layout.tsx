import type { Metadata } from "next";
import Link from "next/link";
import { getOwnerSession, signOut } from "@/lib/auth/owner";
import { getLeadStore, storeKind } from "@/lib/leads/store";
import { listConversations } from "@/lib/owner/conversations";
import { Wordmark } from "@/components/site/Wordmark";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Owner dashboard", template: "%s | Owner dashboard" },
  robots: { index: false, follow: false },
};

// Every admin route depends on the session cookie; never prerender.
export const dynamic = "force-dynamic";

/** Same order as the owner app's tabs, plus Analytics (a desktop job). */
const NAV = [
  { href: "/admin", label: "Today" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/more", label: "More" },
];

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getOwnerSession();
  const demo = storeKind() === "demo";
  // Unread conversations (website messages, requests, replies) for the Inbox badge.
  const store = session ? await getLeadStore() : null;
  const unread = store
    ? (await listConversations(store, { filter: "unread", limit: 100 }).catch(() => ({ items: [] }))).items.length
    : 0;
  const badge = (href: string) =>
    href === "/admin/inbox" && unread > 0 ? (
      <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-apex-deep px-1.5 text-[0.7rem] font-semibold text-white">
        <span className="sr-only">, </span>
        {unread}
        <span className="sr-only"> unread</span>
      </span>
    ) : null;
  return (
    <div className="min-h-full flex flex-col bg-chalk">
      {demo && (
        <div className="bg-apex text-asphalt text-center text-sm px-4 py-2 font-medium">
          DEMO MODE: local data only. Not connected to a production database.
        </div>
      )}
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Wordmark />
            <span className="text-xs uppercase tracking-[0.18em] font-semibold text-apex-deep hidden sm:inline">Owner</span>
          </div>
          {session && (
            <div className="flex items-center gap-4 text-sm">
              <nav aria-label="Dashboard" className="hidden md:flex gap-5">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-apex-deep inline-flex items-center">
                    {n.label}
                    {badge(n.href)}
                  </Link>
                ))}
              </nav>
              <form action={signOutAction}>
                <button type="submit" className="underline underline-offset-4 min-h-10">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
        {session && (
          <nav aria-label="Dashboard mobile" className="md:hidden border-t border-line overflow-x-auto">
            <div className="flex gap-5 px-5 py-2.5 text-sm whitespace-nowrap">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-apex-deep inline-flex items-center">
                  {n.label}
                  {badge(n.href)}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-5 sm:px-8 py-8">{children}</main>
    </div>
  );
}
