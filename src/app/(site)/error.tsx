"use client";

import { useEffect } from "react";
import { business, phoneLink, SMS_PREFILL } from "@/config/business";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";

/**
 * Any page error on the public site (including a booking that failed in a way
 * the form didn't expect): say so plainly and give the phone number, so the
 * customer isn't lost. The site header and the Call/Text/Book bar stay around it.
 */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[site] page error", error.digest ?? error.message);
  }, [error]);

  const tel = phoneLink("tel");
  const sms = phoneLink("sms", SMS_PREFILL);
  return (
    <Container className="py-16 sm:py-24 max-w-2xl">
      <h1 className="font-display text-4xl sm:text-5xl text-balance">Sorry, something went wrong.</h1>
      <p className="mt-4 text-lg text-ink-muted leading-relaxed">
        If you were sending a booking request, it may not have gone through.
        {business.contact.phone ? " Call or text us and we'll book you directly:" : " Please try again."}
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
          <a href={sms} className="inline-flex min-h-12 items-center justify-center rounded-sm border border-apex-deep bg-apex-deep px-5 font-semibold text-white">
            Text us
          </a>
        )}
        <Button type="button" variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </Container>
  );
}
