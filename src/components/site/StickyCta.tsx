"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom CTA. Hidden on pages that already contain the target
 * form or where it would sit on top of form controls, and until the visitor
 * scrolls past the first screen (whose own button says the same thing).
 */
export function StickyCta({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const cta = { label, href };
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/request") ||
    pathname.startsWith("/thanks") ||
    pathname === "/contact" ||
    pathname === "/maintenance-plans";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (hidden) return null;
  return (
    <div
      inert={!scrolled}
      className={cn(
        "lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line-dark bg-asphalt/95 backdrop-blur px-5 pt-3 transition-transform duration-300",
        !scrolled && "translate-y-full",
      )}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <ButtonLink href={cta.href} variant="apex" className="w-full">
        {cta.label}
      </ButtonLink>
    </div>
  );
}
