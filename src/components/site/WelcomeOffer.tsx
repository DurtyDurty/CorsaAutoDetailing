"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { submitOfferSignup } from "@/app/actions/leads";
import { business, isPrelaunch } from "@/config/business";
import { track } from "@/lib/analytics";
import { Arrow } from "@/components/ui/Button";
import { Field, FormMessage, FormMeta, SubmitButton, TextInput, useLeadForm } from "@/components/forms/primitives";
import { Wordmark } from "./Wordmark";

/** Shown this visit already (session), or signed up before (kept). */
const SEEN_KEY = "corsa-offer-seen";
const JOINED_KEY = "corsa-offer-joined";

/**
 * First-time customer offer with an email signup, shown once per visit (browser session) a moment after
 * the first page loads. A banner at the bottom of the screen on phones and a centered one on larger
 * screens; it never covers the whole page on phones, where a full-screen pop-up on arrival counts
 * against the site in Google search. Not shown where the visitor is already booking, or before launch.
 */
export function WelcomeOffer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const skip =
    !business.firstTimeOffer.enabled ||
    isPrelaunch ||
    pathname.startsWith("/request") ||
    pathname.startsWith("/thanks") ||
    pathname.startsWith("/booking");

  useEffect(() => {
    if (skip) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY) || localStorage.getItem(JOINED_KEY)) return;
    } catch {
      return; // Storage blocked: better no pop-up than one on every page.
    }
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        return;
      }
      setOpen(true);
      track("offer_shown");
    }, 1500);
    return () => clearTimeout(timer);
  }, [skip]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || skip) return null;
  return <OfferBanner onClose={() => setOpen(false)} />;
}

function OfferBanner({ onClose }: { onClose: () => void }) {
  const offer = business.firstTimeOffer;
  const { state, onSubmit, pending, errors, message } = useLeadForm(submitOfferSignup, {
    formName: "first_time_offer",
    leadType: "launch_list",
  });
  const joined = state?.status === "ok";

  useEffect(() => {
    if (!joined) return;
    track("offer_claimed");
    try {
      localStorage.setItem(JOINED_KEY, "1");
    } catch {
      // The signup is saved either way.
    }
  }, [joined]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close offer"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 hidden bg-asphalt/70 pointer-events-auto sm:block"
      />
      <div
        role="dialog"
        aria-labelledby="welcome-offer-title"
        className="relative grid max-h-full w-full overflow-y-auto pointer-events-auto bg-white shadow-[0_-16px_48px_-16px_rgba(12,13,16,0.55)] sm:max-w-3xl sm:grid-cols-[5fr_6fr] sm:shadow-[0_32px_80px_-24px_rgba(12,13,16,0.7)]"
      >
        {/* Brand panel: logo and the number. */}
        <div className="on-dark relative flex flex-col overflow-hidden bg-asphalt text-chalk">
          <div className="grid-lines absolute inset-0" aria-hidden="true" />
          <div className="relative flex flex-1 items-center justify-between gap-4 py-3 pl-6 pr-14 sm:flex-col sm:items-center sm:p-8">
            <Wordmark onDark asLink={false} className="[&_img]:h-6 sm:[&_img]:h-8" />
            <p
              className="flex items-baseline gap-2 font-display italic font-extrabold leading-[0.8] sm:flex-col sm:items-center sm:gap-4"
              aria-hidden="true"
            >
              <span>
                <span className="text-4xl sm:text-[9rem]">{offer.percent}</span>
                <span className="text-2xl text-apex sm:text-7xl">%</span>
              </span>
              {/* "OFF" races away and back (globals.css); the smoke stays on the start line. */}
              <span className="relative text-2xl sm:text-6xl">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="offer-smoke" />
                ))}
                <span className="offer-off-word">Off</span>
              </span>
            </p>
            <p className="hidden font-mono text-[0.7rem] uppercase tracking-[0.18em] text-chalk/65 sm:block">Your first detail</p>
          </div>
          <div className="kerb relative h-[4px] shrink-0" aria-hidden="true" />
        </div>

        {/* Offer and signup. */}
        <div className="px-6 pt-4 sm:p-8" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-apex-deep font-semibold">First-time customers</p>
          <h2 id="welcome-offer-title" className="mt-2 pr-8 font-display italic font-extrabold text-3xl leading-[0.95] sm:pr-0 sm:text-4xl">
            {joined ? "You're in." : offer.headline}
          </h2>
          {joined ? (
            <>
              <p className="mt-3 leading-relaxed">
                Your {offer.percent}% off is on its way to your inbox. Ready now? Book and the offer is already selected.
              </p>
              <Link
                href="/request?offer=first-time"
                onClick={onClose}
                className="group mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-apex-deep bg-apex-deep px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#a51109] hover:border-[#a51109] sm:w-auto"
              >
                Book with {offer.percent}% off
                <Arrow />
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3" aria-label="First-time offer signup">
              <p className="hidden leading-relaxed sm:block">{offer.body}</p>
              <FormMeta />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <Field name="firstName" label="First name" error={errors.firstName}>
                  {(p) => <TextInput name="firstName" autoComplete="given-name" required {...p} />}
                </Field>
                <Field name="email" label="Email" error={errors.email}>
                  {(p) => <TextInput name="email" type="email" autoComplete="email" required {...p} />}
                </Field>
              </div>
              <FormMessage message={message} />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <SubmitButton pending={pending} className="w-full sm:w-auto">
                  Send my {offer.percent}% off
                </SubmitButton>
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden min-h-11 px-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted hover:text-ink sm:block"
                >
                  No thanks
                </button>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                {offer.emailNote} {offer.terms}
              </p>
            </form>
          )}
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-1 top-1.5 flex h-11 w-11 items-center justify-center text-2xl leading-none text-chalk/80 hover:text-chalk sm:text-ink-muted sm:hover:text-ink"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  );
}
