import "server-only";
import type { AppointmentDetail } from "@shared/api";
import { PAYMENT_METHOD_LABELS } from "@shared/money";
import { renderInvoicePdf, type InvoiceDocument } from "@/lib/quotes/pdf";
import { ZELLE } from "@/lib/quotes/zelle";
import { formatEastern } from "@/lib/time";

/** A job can be invoiced once it's a firm booking (not a request still waiting, and not one that fell through). */
export const isInvoiceable = (a: Pick<AppointmentDetail, "status">) =>
  a.status === "confirmed" || a.status === "en_route" || a.status === "arrived" || a.status === "in_progress" || a.status === "completed";

/** The same number every time for a job: the accepted quote's number when there is one, so the two documents match. */
export function invoiceNumber(a: Pick<AppointmentDetail, "id" | "quote">): string {
  return a.quote?.status === "accepted" ? a.quote.number.replace(/^Q-/, "INV-") : `INV-${a.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export const invoiceFilename = (a: Pick<AppointmentDetail, "id" | "quote">) => `Corsa-Invoice-${invoiceNumber(a).replace(/^INV-/, "")}.pdf`;

export function invoiceDocument(a: AppointmentDetail, issuedAt = new Date().toISOString()): InvoiceDocument {
  const serviceName = a.serviceName ?? "Detail";
  // The accepted quote lists the work line by line, unless the price was changed after it was accepted.
  const quoted = a.quote?.status === "accepted" && a.quote.subtotalCents === a.quotedPriceCents ? a.quote.lines : null;
  const payments = a.payments.map((p) => ({
    label: `${p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} ${formatEastern(p.createdAt, { dateStyle: "medium", timeStyle: undefined })} (${PAYMENT_METHOD_LABELS[p.method].replace(/ \(.*$/, "")})`,
    amountCents: p.kind === "refund" ? -p.amountCents : p.amountCents,
  }));
  // Money counted outside the ledger (an online deposit, or a job closed before the ledger existed).
  const other = a.balance.collectedCents - payments.reduce((s, p) => s + p.amountCents, 0);
  if (other > 0) payments.unshift({ label: "Paid earlier", amountCents: other });
  return {
    number: invoiceNumber(a),
    issuedAt,
    customer: {
      name: a.customerName,
      email: a.email,
      phone: a.phone,
      address: [a.serviceAddress, a.city, a.zip].filter(Boolean).join(", ") || null,
    },
    appointment: {
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      serviceName,
      vehicle: [a.vehicle.year, a.vehicle.make, a.vehicle.model].filter(Boolean).join(" ") || null,
    },
    lines: quoted ?? [{ label: serviceName, amountCents: a.quotedPriceCents }],
    subtotalCents: a.quotedPriceCents,
    discountCents: Math.min(Math.max(0, a.discountCents), a.quotedPriceCents),
    totalCents: a.balance.totalCents,
    payments,
    balanceDueCents: a.balance.balanceDueCents,
    zelle: ZELLE,
  };
}

export const renderInvoice = (a: AppointmentDetail) => renderInvoicePdf(invoiceDocument(a));
