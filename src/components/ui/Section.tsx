import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  id,
  className,
  tone = "ivory",
  children,
}: {
  id?: string;
  className?: string;
  tone?: "ivory" | "white" | "dark";
  children: ReactNode;
}) {
  const tones = {
    ivory: "bg-ivory text-ink",
    white: "bg-white text-ink",
    dark: "bg-charcoal text-ivory on-dark",
  };
  return (
    <section id={id} className={cn("py-16 sm:py-24", tones[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-champagne-deep", className)}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
  onDark,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <Eyebrow className={onDark ? "text-champagne" : undefined}>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-3xl sm:text-4xl mt-3 text-balance">{title}</h2>
      {lede && <p className={cn("mt-4 text-lg leading-relaxed", onDark ? "text-ivory/80" : "text-ink-muted")}>{lede}</p>}
    </div>
  );
}
