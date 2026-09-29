import Link from "next/link";
import { business } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { formatEastern } from "@/lib/time";
import { formatUsd } from "@/lib/pricing";

function thirtyDaysAgoIso() {
  return new Date(Date.now() - 30 * 86400_000).toISOString();
}

export default async function AppointmentsPage() {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  // Abandoned online checkouts (hold released, nothing paid) are noise here.
  const appts = (await store.listAppointments({ from: thirtyDaysAgoIso() })).filter((a) => a.depositStatus !== "released");
  const leads = new Map(
    (await Promise.all(appts.map((a) => store.getLead(a.leadId)))).filter(Boolean).map((l) => [l!.id, l!]),
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl">Appointments</h1>
        <p className="text-ink-muted text-sm mt-1">
          Work hours {business.scheduling.workHours.start} to {business.scheduling.workHours.end} ET · {business.scheduling.travelBufferMinutes} min travel
          buffer · times shown in Eastern
        </p>
      </div>
      {appts.length === 0 ? (
        <p className="text-ink-muted border border-line bg-white rounded-md p-6">No appointments in the last 30 days or upcoming.</p>
      ) : (
        <div className="overflow-x-auto border border-line bg-white rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Quoted</th>
                <th className="px-4 py-3 font-medium">Deposit</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {appts.map((a) => {
                const lead = leads.get(a.leadId);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatEastern(a.startsAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatEastern(a.endsAt, { timeStyle: "short", dateStyle: undefined })}</td>
                    <td className="px-4 py-3">
                      {lead ? (
                        <Link href={`/admin/leads/${lead.id}`} className="underline underline-offset-4">
                          {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">{formatUsd(a.quotedPriceCents / 100)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.depositCents ? `${formatUsd(a.depositCents / 100)} ${a.depositStatus}` : "-"}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {a.status}
                      {a.status === "completed" && a.completedRevenueCents !== null && (
                        <span className="text-ink-muted"> · {formatUsd(a.completedRevenueCents / 100)} collected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
