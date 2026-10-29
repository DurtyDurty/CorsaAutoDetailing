import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business, phoneLink } from "@/config/business";
import { dict } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Section";
import { getLeadStore } from "@/lib/leads/store";
import { formatUsd } from "@/lib/pricing";
import { formatPhone, shortRef } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Gracias",
  robots: { index: false, follow: false },
};

/** Spanish confirmation for the booking form (the only Spanish form that lands here). */
export default async function GraciasPage({ params, searchParams }: PageProps<"/es/thanks/[kind]">) {
  const { kind } = await params;
  const { ref } = await searchParams;
  if (kind !== "request") notFound();
  const t = dict("es").thanks;

  // Only show success for a lead that actually exists in durable storage.
  const store = await getLeadStore();
  const lead = typeof ref === "string" && store ? await store.getLead(ref).catch(() => null) : null;
  const requested = lead && store ? (await store.listAppointments({ leadId: lead.id })).find((a) => a.status === "held" && a.depositStatus === "none") : undefined;
  const phone = business.contact.phone;

  if (!lead) {
    return (
      <Container className="max-w-2xl py-20" >
        <div lang="es">
          <h1 className="font-display text-4xl">{t.notFoundTitle}</h1>
          <p className="mt-4 leading-relaxed text-ink-muted">
            {t.notFoundBody} {dict("es").form.failed(phone)}
          </p>
          <Link href="/es" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-asphalt px-6 font-semibold text-chalk">
            {t.home}
          </Link>
        </div>
      </Container>
    );
  }

  const day = requested
    ? new Intl.DateTimeFormat("es-US", { dateStyle: "full", timeZone: business.timeZone }).format(new Date(requested.startsAt))
    : null;
  return (
    <Container className="max-w-2xl py-20">
      <div lang="es">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-apex-deep">
          {t.reference} {shortRef(lead.id)}
        </p>
        <h1 className="mt-3 font-display text-4xl text-balance sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-muted">{lead.email ? t.withEmail : t.noEmail(lead.phone ? formatPhone(lead.phone) : "")}</p>
        {requested && day && (
          <div className="mt-8 rounded-md border-l-[3px] border-apex-deep bg-white px-5 py-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-apex-deep">{t.askedFor}</p>
            <p className="mt-2 font-display text-2xl">{day}</p>
            {requested.notes && <p className="mt-1 text-ink-muted">{requested.notes.replace(/^Morning or afternoon/, "Mañana o tarde").replace(/^Morning/, "Mañana").replace(/^Afternoon/, "Tarde")}</p>}
          </div>
        )}
        {lead.estimate && lead.estimate.total !== null && (
          <div className="mt-8 rounded-md border border-line bg-white p-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-apex-deep">{t.estimate}</p>
            <p className="mt-2 flex items-baseline justify-between gap-4">
              <span>{lead.estimate.serviceName}</span>
              <span className="font-display text-2xl">{formatUsd(lead.estimate.total)}</span>
            </p>
            <p className="mt-3 text-xs text-ink-muted">Precio final confirmado después de revisar el vehículo en persona. Cualquier impuesto aplicable se indicará en tu cotización final.</p>
          </div>
        )}
        {phone && (
          <p className="mt-6 text-ink-muted">
            {t.questions}{" "}
            <a href={phoneLink("tel") ?? undefined} className="font-semibold text-ink underline underline-offset-4">
              {phone}
            </a>
            .
          </p>
        )}
        <Link href="/es" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-asphalt px-6 font-semibold text-chalk">
          {t.home}
        </Link>
      </div>
    </Container>
  );
}
