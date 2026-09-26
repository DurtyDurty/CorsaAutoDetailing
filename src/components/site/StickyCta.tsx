"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Mobile-only bottom CTA. Hidden on pages that already contain the target
 * form or where it would sit on top of form controls.
 */
export function StickyCta({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const cta = { label, href };
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/request") ||
    pathname.startsWith("/thanks") ||
    pathname === "/contact" ||
    pathname === "/maintenance-plans";
  if (hidden) return null;
  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 backdrop-blur px-5 pt-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <ButtonLink href={cta.href} className="w-full">
        {cta.label}
      </ButtonLink>
    </div>
  );
}
