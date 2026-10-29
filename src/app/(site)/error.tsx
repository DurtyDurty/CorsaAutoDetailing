"use client";

import { useEffect } from "react";
import { business, phoneLink, SMS_PREFILL, SMS_PREFILL_ES } from "@/config/business";
import { useLang } from "@/i18n/use-lang";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";

/**
 * Any page error on the public site (including a booking that failed in a way
 * the form didn't expect): say so plainly and give the phone number, so the
 * customer isn't lost. The site header and the Call/Text/Book bar stay around it.
 */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useLang();
  useEffect(() => {
    console.error("[site] page error", error.digest ?? error.message);
  }, [error]);

  const es = lang === "es";
  const tel = phoneLink("tel");
  const sms = phoneLink("sms", es ? SMS_PREFILL_ES : SMS_PREFILL);
  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <div lang={lang}>
        <h1 className="font-display text-4xl text-balance sm:text-5xl">{es ? "Lo sentimos, algo salió mal." : "Sorry, something went wrong."}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {es ? "Si estabas enviando una solicitud, puede que no se haya enviado." : "If you were sending a booking request, it may not have gone through."}
          {business.contact.phone
            ? es
              ? " Llámanos o escríbenos y te agendamos directamente:"
              : " Call or text us and we'll book you directly:"
            : es
              ? " Inténtalo de nuevo."
              : " Please try again."}
        </p>
        {tel && (
          <p className="mt-3 font-display text-3xl">
            <a href={tel} className="underline underline-offset-4">
              {business.contact.phone}
            </a>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {sms && (
            <a href={sms} className="inline-flex min-h-12 items-center justify-center rounded-full border border-apex-deep bg-apex-deep px-5 font-semibold text-white">
              {es ? "Escríbenos" : "Text us"}
            </a>
          )}
          <Button type="button" variant="secondary" onClick={() => retry()}>
            {es ? "Intentar de nuevo" : "Try again"}
          </Button>
        </div>
      </div>
    </Container>
  );
}
