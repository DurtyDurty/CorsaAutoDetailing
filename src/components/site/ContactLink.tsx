"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function ContactLink({
  method,
  href,
  children,
  className,
}: {
  method: "email" | "phone";
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className ?? "hover:text-chalk"} onClick={() => track("contact_clicked", { method })}>
      {children}
    </a>
  );
}
