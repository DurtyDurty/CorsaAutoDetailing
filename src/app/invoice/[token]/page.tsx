import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { formatCents } from "@shared/money";
import { getLeadStore } from "@/lib/leads/store";
import { invoiceDocument, loadInvoiceByToken } from "@/lib/owner/invoice";
import { formatEastern } from "@/lib/time";
import { formatPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const day = (iso: string) => formatEastern(iso, { dateStyle: "full", timeStyle: undefined });
const time = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: "short" });
const money = (cents: number) => (cents < 0 ? `-${formatCents(-cents)}` : formatCents(cents));

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{children}</p>;
}

export default async function InvoicePage({ params }: PageProps<"/invoice/[token]">) {
  const { token } = await params;
  const store = await getLeadStore();
  const appointment = store ? await loadInvoiceByToken(store, token) : null;
  if (!appointment) notFound();

  const doc = invoiceDocument(appointment);
  const contact = [business.contact.phone ? formatPhone(business.contact.phone.replace(/\D/g, "")) : null, business.contact.email].filter(Boolean).join(" · ");

  return (
    <main className="flex-1 bg-chalk-deep py-6 sm:py-12 px-3 sm:px-6">
      <article className="mx-auto max-w-3xl bg-white shadow-[0_1px_3px_rgba(12,13,16,0.12),0_12px_32px_rgba(12,13,16,0.08)]" aria-label={`Invoice ${doc.number}`}>
        <header className="bg-asphalt text-chalk px-6 sm:px-10 py-7 sm:py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-4 border-apex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={business.brand.logos.horizontalLight ?? "/brand/logo-light.svg"} alt={business.brand.name} className="h-11 sm:h-12 w-auto self-start" />
          <div className="sm:text-right">
            <p className="font-display text-4xl leading-none">INVOICE</p>
            <p className="mt-2 text-sm text-[#9aa0ab]">No. {doc.number}</p>
            <p className="text-sm text-[#9aa0ab]">Issued {formatEastern(doc.issuedAt, { dateStyle: "medium", timeStyle: undefined })}</p>
          </div>
        </header>

        <div className="px-6 sm:px-10 py-8 flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label>Billed to</Label>
              <p className="mt-2 text-lg font-semibold">{doc.customer.name}</p>
              {doc.customer.address && <p className="text-sm text-ink-muted">{doc.customer.address}</p>}
              {doc.customer.email && <p className="text-sm text-ink-muted">{doc.customer.email}</p>}
              {doc.customer.phone && <p className="text-sm text-ink-muted">{formatPhone(doc.customer.phone)}</p>}
            </div>
            <div>
              <Label>Service</Label>
              <p className="mt-2 text-lg font-semibold">{doc.appointment.serviceName}</p>
              <p className="text-sm text-ink-muted">{day(doc.appointment.startsAt)}</p>
              <p className="text-sm text-ink-muted">{time(doc.appointment.startsAt)} – {time(doc.appointment.endsAt)} (Eastern)</p>
              {doc.appointment.vehicle && <p className="text-sm text-ink-muted">{doc.appointment.vehicle}</p>}
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-chalk">
                <th scope="col" className="px-4 py-3"><Label>Description</Label></th>
                <th scope="col" className="px-4 py-3 text-right"><Label>Amount</Label></th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line, index) => (
                <tr key={index} className="border-b border-line">
                  <td className="px-4 py-3.5">{line.label}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{formatCents(line.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sm:ml-auto sm:w-80 flex flex-col gap-2">
            <p className="flex justify-between text-sm text-ink-muted"><span>Subtotal</span><span className="tabular-nums text-ink">{formatCents(doc.subtotalCents)}</span></p>
            {doc.discountCents > 0 && <p className="flex justify-between text-sm text-ink-muted"><span>Discount</span><span className="tabular-nums text-ink">-{formatCents(doc.discountCents)}</span></p>}
            <p className="flex justify-between text-sm font-semibold"><span>Total</span><span className="tabular-nums">{formatCents(doc.totalCents)}</span></p>
            {doc.payments.map((payment, index) => (
              <p key={index} className="flex justify-between text-sm text-ink-muted"><span>{payment.label}</span><span className="tabular-nums">{money(payment.amountCents)}</span></p>
            ))}
            <p className="mt-1 flex items-center justify-between bg-asphalt text-chalk border-l-4 border-apex px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa0ab]">{doc.balanceDueCents > 0 ? "Balance due" : "Paid in full"}</span>
              <span className="font-display text-3xl tabular-nums">{formatCents(doc.balanceDueCents)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm">
            <a href={`/invoice/${token}/pdf`} className="underline underline-offset-4 font-medium">Download invoice PDF</a>
            <span className="text-ink-muted">{business.brand.name}{contact ? ` · ${contact}` : ""}</span>
          </div>
        </div>
      </article>
    </main>
  );
}