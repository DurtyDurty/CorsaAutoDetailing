"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict } from "@/i18n/dictionary";

/** The page links in a drop-down panel below the header, on screens without the full nav. */
export function MobileNav({ links, d }: { links: { href: string; label: string }[]; d: Dict }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();

  // Close on navigation (state adjusted during render, per React docs).
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? d.nav.close : d.nav.menu}</span>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
        </svg>
      </button>
      <div id={panelId} hidden={!open} className="absolute inset-x-0 top-full border-b border-line-dark bg-night shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)]">
        <nav aria-label={d.nav.primaryMobile} className="flex flex-col px-5 py-3">
          {links.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              ref={i === 0 ? firstLinkRef : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-4 border-b border-line-dark py-3.5 font-display text-3xl last:border-0 hover:text-apex"
            >
              <span className="race-num !h-7 !min-w-10 !text-sm" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
