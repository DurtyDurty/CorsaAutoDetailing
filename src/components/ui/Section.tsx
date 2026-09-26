import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  id,
  className,
  tone = "chalk",
  children,
}: {
  id?: string;
  className?: string;
  tone?: "chalk" | "white" | "dark";
  children: ReactNode;
}) {
  const tones = {
    chalk: "bg-chalk text-ink",
    white: "bg-white text-ink",
    dark: "bg-asphalt text-chalk on-dark",
  };
  return (
    <section id={id} className={cn("py-16 sm:py-24", tones[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** Telemetry-style label: a short red bar plus monospaced caps. */
export function Eyebrow({
  children,
  className,
  onDark,
}: {
  children: ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em]",
        onDark ? "text-apex" : "text-apex-deep",
        className,
      )}
    >
      <span aria-hidden="true" className="h-[3px] w-5 bg-current" />
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
      {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-4xl sm:text-5xl mt-4 text-balance">{title}</h2>
      {lede && <p className={cn("mt-5 text-lg leading-relaxed", onDark ? "text-chalk/75" : "text-ink-muted")}>{lede}</p>}
    </div>
  );
}
