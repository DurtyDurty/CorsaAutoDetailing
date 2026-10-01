"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** A submit button that asks first (browser dialog) when `confirm` is set. */
export function ConfirmSubmit({
  children,
  confirm,
  variant = "primary",
  size = "sm",
  className,
  disabled,
}: {
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "apex" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}