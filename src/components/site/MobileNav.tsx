"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./nav";
import { ButtonLink } from "@/components/ui/Button";

export function MobileNav({ cta }: { cta: { label: string; href: string } }) {
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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center gap-2 min-h-11 px-3 -mr-3 text-sm font-medium"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? "Close" : "Menu"}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full bg-asphalt border-b border-line-dark shadow-[0_24px_48px_-20px_rgba(0,0,0,0.6)]"
      >
        <nav aria-label="Primary mobile" className="px-5 py-4 flex flex-col">
          {NAV_LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              ref={i === 0 ? firstLinkRef : undefined}
              className="flex items-baseline gap-4 py-3.5 border-b border-line-dark last:border-0 font-display text-3xl hover:text-apex"
            >
              <span className="font-mono text-xs font-normal text-apex" aria-hidden="true">
                0{i + 1}
              </span>
              {l.label}
            </Link>
          ))}
          <ButtonLink href={cta.href} variant="apex" className="mt-4 w-full">
            {cta.label}
          </ButtonLink>
        </nav>
      </div>
    </div>
  );
}
