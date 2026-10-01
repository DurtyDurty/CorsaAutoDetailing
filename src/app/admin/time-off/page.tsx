import type { Metadata } from "next";
import { isBlocking } from "@shared/appointment-status";
import Link from "next/link";
import { business } from "@/config/business";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { formatEastern, formatEasternDate, todayEastern } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { addTimeOffAction, removeTimeOffAction } from "../actions";

export const metadata: Metadata = { title: "Days off" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TimeOffPage({ searchParams }: PageProps<"/admin/time-off">) {
  await requireOwner();
  const sp = await searchParams;
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;

  const today = todayEastern();
  const daysOff = await store.listTimeOff({ from: today });
  // Bookings that already sit on a day off are kept; flag them so they can be moved.
  const appts = daysOff.length
    ? (await store.listAppointments({ from: new Date().toISOString() })).filter(
        (a) => isBlocking(a.status),
      )
    : [];
  const onDay = (day: string) => appts.filter((a) => todayEastern(new Date(a.startsAt)) === day);
  const leads = new Map(
    (await Promise.all([...new Set(appts.map((a) => a.leadId))].map((id) => store.getLead(id))))
      .filter(Boolean)
      .map((l) => [l!.id, l!]),
  );
  const workDays = business.scheduling.workDays.map((d) => WEEKDAYS[d]).join(", ");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl">Days off</h1>
        <p className="text-ink-muted text-sm mt-1">
          Days you block here disappear from the online booking calendar. You normally work {workDays},{" "}
          {business.scheduling.workHours.start} to {business.scheduling.workHours.end} ET.
        </p>
      </div>

      {typeof sp.ok === "string" && (
        <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
          {sp.ok}
        </p>
      )}
      {typeof sp.error === "string" && (
        <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
          {sp.error}
        </p>
      )}

      <form action={addTimeOffAction} className="border border-line bg-white rounded-md p-5 sm:p-6 flex flex-col gap-4">
        <h2 className="font-semibold">Block time off</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-sm font-medium">
              Day off (or first day)
            </label>
            <input id="from" name="from" type="date" min={today} className="field" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-sm font-medium">
              Last day <span className="font-normal text-ink-muted">(optional, for a range)</span>
            </label>
            <input id="to" name="to" type="date" min={today} className="field" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className="text-sm font-medium">
            Note <span className="font-normal text-ink-muted">(optional, only you see this)</span>
          </label>
          <input id="note" name="note" type="text" maxLength={200} placeholder="Vacation, appointment, holiday…" className="field" />
        </div>
        <div>
          <Button type="submit">Block these days</Button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Upcoming days off</h2>
        {daysOff.length === 0 ? (
          <p className="text-ink-muted border border-line bg-white rounded-md p-6">No days off scheduled. Every working day is open for booking.</p>
        ) : (
          <ul className="border border-line bg-white rounded-md divide-y divide-line">
            {daysOff.map((t) => {
              const booked = onDay(t.day);
              return (
                <li key={t.day} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{formatEasternDate(t.day)}</span>
                    {t.note && <span className="text-sm text-ink-muted">{t.note}</span>}
                    {booked.map((a) => {
                      const lead = leads.get(a.leadId);
                      return (
                        <span key={a.id} className="text-sm text-error">
                          Already booked: {formatEastern(a.startsAt, { dateStyle: undefined })}
                          {lead && (
                            <>
                              {" with "}
                              <Link href={`/admin/leads/${lead.id}`} className="underline underline-offset-4">
                                {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                              </Link>
                            </>
                          )}
                          . Reschedule or cancel it.
                        </span>
                      );
                    })}
                  </div>
                  <form action={removeTimeOffAction}>
                    <input type="hidden" name="day" value={t.day} />
                    <Button type="submit" variant="secondary" size="sm" aria-label={`Reopen ${formatEasternDate(t.day)}`}>
                      Reopen
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
