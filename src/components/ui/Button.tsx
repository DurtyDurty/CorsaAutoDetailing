import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "apex" | "outline-light" | "danger";
type Size = "md" | "lg" | "sm";

const base =
  "group inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-[0.08em] rounded-sm border transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-asphalt text-chalk border-asphalt hover:bg-apex-deep hover:border-apex-deep hover:text-white",
  secondary: "bg-transparent text-asphalt border-asphalt hover:bg-asphalt hover:text-chalk",
  ghost: "bg-transparent text-asphalt border-transparent hover:bg-chalk-deep",
  apex: "bg-apex-deep text-white border-apex-deep hover:bg-[#a51109] hover:border-[#a51109]",
  "outline-light": "bg-transparent text-chalk border-chalk/35 hover:bg-chalk hover:text-asphalt hover:border-chalk",
  danger: "bg-transparent text-error border-error hover:bg-error hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "text-[0.8rem] px-3.5 py-2 min-h-10",
  md: "text-sm px-5 py-3 min-h-12",
  lg: "text-[0.95rem] px-7 py-3.5 min-h-14",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

/** Trailing arrow that nudges forward on hover. Decorative. */
export function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="transition-transform group-hover:translate-x-1"
    >
      <path d="M3 9h11M10 4.5L14.5 9 10 13.5" />
    </svg>
  );
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
