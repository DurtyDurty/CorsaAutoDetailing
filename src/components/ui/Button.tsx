import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "champagne" | "danger";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-sm border transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-charcoal text-ivory border-charcoal hover:bg-charcoal-soft",
  secondary: "bg-transparent text-charcoal border-charcoal hover:bg-charcoal hover:text-ivory",
  ghost: "bg-transparent text-charcoal border-transparent hover:bg-ivory-deep",
  champagne: "bg-champagne text-charcoal border-champagne hover:bg-[#c2a97a]",
  danger: "bg-transparent text-error border-error hover:bg-error hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-2 min-h-10",
  md: "text-base px-5 py-3 min-h-12",
  lg: "text-base px-6 py-3.5 min-h-13",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
