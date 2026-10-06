import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { formatCents } from "@shared/money";
import { getLeadStore } from "@/lib/leads/store";
import { loadQuoteByToken } from "@/lib/quotes/service";
import { formatEastern } from "@/lib/time";
import { formatPhone } from "@/lib/utils";
import { acceptQuoteAction, declineQuoteAction } from "./actions";

/**
 * The customer's quote, laid out like the PDF. Outside the site layout on
 * purpose: no analytics or tracking scripts ever see the private link.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const ERRORS: Record<string, string> = {
  agree: "Tick the box to accept the quote and its terms.",
  busy: "Too many attempts. Wait a few minutes and try again.",
  unavailable: "We can't take your answer right now. Please try again shortly or reply to our email.",
};

const day = (iso: string) => formatEastern(iso, { dateStyle: "full", timeStyle: undefined });
const time = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: "short" });

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{children}</p>;
}

export default async function QuotePage({ params, searchParams }: PageProps<"/quote/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const store = await getLeadStore();
  const found = store ? await loadQuoteByToken(store, token) : null;
  if (!found) notFound();

  const { quote: q, status, appointment: a, lead } = found;
  const name = lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "Customer";
  const address = lead ? [lead.serviceAddress, lead.city, lead.zip].filter(Boolean).join(", ") : "";
  const vehicle = lead ? [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") : "";
  const service = q.lines[0]?.label ?? "Detail";
  const error = typeof sp.e === "string" ? ERRORS[sp.e] : undefined;
  const lostTime = status === "withdrawn" && q.responseNote === "Time no longer held when accepted";
  const contact = [business.contact.phone ? formatPhone(business.contact.phone.replace(/\D/g, "")) : null, business.contact.email].filter(Boolean).join(" · ");

  const banner =
    status === "accepted"
      ? { tone: "ok", title: "You're booked.", body: `Your appointment on ${day(a.startsAt)} at ${time(a.startsAt)} is confirmed. A confirmation is on its way to your email.` }
      : status === "declined"
        ? { tone: "info", title: "Quote declined.", body: "Thanks for letting us know. The time has been released. Reply to our email any time if you'd like a new quote." }
        : status === "expired"
          ? { tone: "info", title: "This quote has expired.", body: "Reply to our email or request a new time and we'll send you a fresh quote." }
          : status === "withdrawn"
            ? {
                tone: "info",
                title: lostTime ? "That time is no longer available." : "This quote was replaced.",
                body: lostTime ? "Sorry about that. Reply to our email and we'll find another time." : "We sent you an updated quote. Check your email for the latest one.",
              }
            : null;

  return (
    <main className="flex-1 bg-chalk-deep py-6 sm:py-12 px-3 sm:px-6">
      <article className="mx-auto max-w-3xl bg-white shadow-[0_1px_3px_rgba(12,13,16,0.12),0_12px_32px_rgba(12,13,16,0.08)]" aria-label={`Quote ${q.number}`}>
        <header className="bg-asphalt text-chalk px-6 sm:px-10 py-7 sm:py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-4 border-apex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={business.brand.logos.horizontalLight ?? "/brand/logo-light.svg"} alt={business.brand.name} className="h-11 sm:h-12 w-auto self-start" />
          <div className="sm:text-right">
            <p className="font-display text-4xl tracking-wide leading-none">QUOTE</p>
            <p className="mt-2 text-sm text-[#9aa0ab]">No. {q.number}</p>
            <p className="text-sm text-[#9aa0ab]">Issued {formatEastern(q.createdAt, { dateStyle: "medium", timeStyle: undefined })}</p>
            {status === "sent" && <p className="text-sm font-semibold">Valid until {formatEastern(q.expiresAt, { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>
        </header>

        <div className="px-6 sm:px-10 py-8 flex flex-col gap-8">
          {banner && (
            <div
              role="status"
              className={
                banner.tone === "ok"
                  ? "border-l-4 border-success bg-[#eef6ef] px-5 py-4"
                  : "border-l-4 border-ink-muted bg-chalk px-5 py-4"
              }
            >
              <p className={banner.tone === "ok" ? "font-display text-2xl text-success" : "font-display text-2xl"}>{banner.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{banner.body}</p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label>Prepared for</Label>
              <p className="mt-2 text-lg font-semibold">{name}</p>
              {address && <p className="text-sm text-ink-muted">{address}</p>}
              {lead?.email && <p className="text-sm text-ink-muted">{lead.email}</p>}
              {lead?.phone && <p className="text-sm text-ink-muted">{formatPhone(lead.phone)}</p>}
            </div>
            <div>
              <Label>Appointment</Label>
              <p className="mt-2 text-lg font-semibold">{service}</p>
              <p className="text-sm text-ink-muted">{day(a.startsAt)}</p>
              <p className="text-sm text-ink-muted">
                {time(a.startsAt)} – {time(a.endsAt)} (Eastern)
              </p>
              {vehicle && <p className="text-sm text-ink-muted">{vehicle}</p>}
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-chalk">
                <th scope="col" className="px-4 py-3">
                  <Label>Description</Label>
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <Label>Amount</Label>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="px-4 py-3.5">{l.label}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{formatCents(l.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sm:ml-auto sm:w-80 flex flex-col gap-2">
            <p className="flex justify-between text-sm text-ink-muted">
              <span>Subtotal</span>
              <span className="tabular-nums text-ink">{formatCents(q.subtotalCents)}</span>
            </p>
            {q.discountCents > 0 && (
              <p className="flex justify-between text-sm text-ink-muted">
                <span>Discount</span>
                <span className="tabular-nums text-ink">-{formatCents(q.discountCents)}</span>
              </p>
            )}
            <p className="mt-1 flex items-center justify-between bg-asphalt text-chalk border-l-4 border-apex px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa0ab]">Total</span>
              <span className="font-display text-3xl tabular-nums">{formatCents(q.totalCents)}</span>
            </p>
          </div>

          {q.notes && (
            <div className="border-l-[3px] border-apex bg-chalk px-5 py-4">
              <Label>A note from {business.owner.name.split(" ")[0]}</Label>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{q.notes}</p>
            </div>
          )}

          {status === "sent" && (
            <section aria-label="Your answer" className="flex flex-col gap-4 border-t border-line pt-8">
              <h2 className="font-display text-3xl">Ready to book?</h2>
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
              <form action={acceptQuoteAction} className="flex flex-col gap-4">
                <input type="hidden" name="token" value={token} />
                <label className="flex items-start gap-3 text-sm leading-relaxed">
                  <input type="checkbox" name="agree" required className="checkbox mt-0.5" />
                  <span>
                    I accept this quote of <strong>{formatCents(q.totalCents)}</strong> for {day(a.startsAt)} at {time(a.startsAt)}, and the terms below.
                  </span>
                </label>
                <button type="submit" className="inline-flex justify-center items-center rounded-sm bg-apex-deep hover:bg-apex text-white font-semibold uppercase tracking-[0.08em] px-7 py-4 min-h-14 sm:w-fit">
                  Accept &amp; confirm my appointment
                </button>
              </form>
              <details className="text-sm">
                <summary className="cursor-pointer underline underline-offset-4 w-fit">Decline this quote</summary>
                <form action={declineQuoteAction} className="mt-3 flex flex-col gap-3 max-w-lg">
                  <input type="hidden" name="token" value={token} />
                  <label className="flex flex-col gap-1">
                    <span>Anything we should know? (optional)</span>
                    <textarea name="reason" maxLength={500} rows={3} className="field" placeholder="e.g. need a different day, price, or service" />
                  </label>
                  <button type="submit" className="inline-flex justify-center items-center rounded-sm border border-asphalt px-5 py-2.5 font-semibold uppercase tracking-[0.08em] text-[0.8rem] w-fit">
                    Decline quote
                  </button>
                </form>
              </details>
            </section>
          )}

          <section aria-label="Terms" className="flex flex-col gap-2 text-xs text-ink-muted leading-relaxed border-t border-line pt-6">
            <Label>Terms</Label>
            <p>{business.disclosures.inspection}</p>
            <p>
              {business.finalQuoteNotice} {business.taxNotice}
            </p>
            <p>If weather prevents the service, we&rsquo;ll reschedule at no charge.</p>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm">
            <a href={`/quote/${token}/pdf`} className="underline underline-offset-4 font-medium">
              Download PDF
            </a>
            <span className="text-ink-muted">
              {business.brand.name}
              {contact ? ` · ${contact}` : ""}
            </span>
          </div>
        </div>
      </article>
    </main>
  );
}
