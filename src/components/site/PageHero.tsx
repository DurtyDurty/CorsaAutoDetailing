import type { ReactNode } from "react";
import { Container, Eyebrow } from "@/components/ui/Section";

export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-ivory">
      <Container className="py-14 sm:py-20">
        <div className="max-w-3xl">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="font-display text-4xl sm:text-5xl mt-3 text-balance">{title}</h1>
          {lede && <p className="mt-5 text-lg sm:text-xl text-ink-muted leading-relaxed">{lede}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </Container>
    </div>
  );
}
