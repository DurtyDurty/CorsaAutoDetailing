import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireOwner } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { bookingOptions, customerOptions } from "@/lib/owner/schedule";
import { addDays, todayEastern } from "@/lib/time";
import { BookForm } from "@/components/admin/work/BookForm";

export const metadata: Metadata = { title: "New appointment" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookPage({ searchParams }: PageProps<"/admin/book">) {
  await requireOwner();
  const store = await getLeadStore();
  if (!store) return <p>Lead store unavailable.</p>;
  const sp = await searchParams;
  const presetLeadId = typeof sp.leadId === "string" && UUID.test(sp.leadId) ? sp.leadId : undefined;
  const options = bookingOptions();
  let customers = await customerOptions(store);
  if (presetLeadId && !customers.some((c) => c.leadId === presetLeadId)) {
    const lead = await store.getLead(presetLeadId);
    if (lead) {
      customers = [
        { leadId: lead.id, name: [lead.firstName, lead.lastName].filter(Boolean).join(" "), email: lead.email, phone: lead.phone, address: null, vehicle: null, serviceId: lead.serviceId },
        ...customers,
      ];
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl">New appointment</h1>
      {!options.bookingOpen ? (
        <p className="text-sm text-ink-muted">The website is in pre-launch mode, so appointments can&rsquo;t be booked yet.</p>
      ) : (
        <BookForm options={options} customers={customers} presetLeadId={presetLeadId} requestId={randomUUID()} defaultDate={addDays(todayEastern(), 1)} />
      )}
    </div>
  );
}