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

/** Small label above a page title: spaced caps in the brand red. */
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
        "text-xs font-semibold uppercase tracking-[0.14em]",
        onDark ? "text-apex" : "text-apex-deep",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Section title and lede. Sections carry no label above the title; the title says what the section is. */
export function SectionHeading({
  title,
  lede,
  className,
  onDark,
}: {
  title: string;
  lede?: string;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <h2 className="font-display text-4xl sm:text-5xl text-balance">{title}</h2>
      {lede && <p className={cn("mt-5 text-lg leading-relaxed", onDark ? "text-chalk/75" : "text-ink-muted")}>{lede}</p>}
    </div>
  );
}
