import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

const TONES = {
  chalk: "bg-chalk text-ink",
  white: "bg-white text-ink",
  dark: "bg-asphalt text-chalk on-dark",
  /** The redesigned public pages (2026-10-28) alternate these two dark surfaces. */
  night: "bg-night text-chalk on-dark",
  night2: "bg-night-2 text-chalk on-dark",
} as const;

export type SectionTone = keyof typeof TONES;
export const isDarkTone = (t: SectionTone) => t === "dark" || t === "night" || t === "night2";

export function Section({
  id,
  className,
  tone = "chalk",
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  tone?: SectionTone;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-16 sm:py-24 scroll-mt-16", TONES[tone], className)}>
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

/**
 * Section title and lede. `num` adds a race-number marker ("01") above the title on the redesigned pages;
 * it's decorative, so screen readers hear only the title.
 */
export function SectionHeading({
  title,
  lede,
  className,
  onDark,
  num,
  id,
}: {
  title: string;
  lede?: string;
  className?: string;
  onDark?: boolean;
  num?: number;
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {num !== undefined && (
        <span className="race-num mb-4" aria-hidden="true">
          {String(num).padStart(2, "0")}
        </span>
      )}
      <h2 id={id} className="font-display text-4xl sm:text-5xl text-balance">
        {title}
      </h2>
      {lede && <p className={cn("mt-4 text-lg leading-relaxed", onDark ? "text-chalk/75" : "text-ink-muted")}>{lede}</p>}
    </div>
  );
}
