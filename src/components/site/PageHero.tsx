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
    <div className="relative overflow-hidden bg-asphalt text-chalk on-dark">
      <div className="grid-lines absolute inset-0" aria-hidden="true" />
      <div
        className="absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-apex/15 blur-3xl"
        aria-hidden="true"
      />
      <Container className="relative py-16 sm:py-24">
        <div className="max-w-3xl">
          {eyebrow && <Eyebrow onDark>{eyebrow}</Eyebrow>}
          <h1 className="font-display italic font-extrabold text-5xl sm:text-7xl mt-5 text-balance">{title}</h1>
          {lede && <p className="mt-6 text-lg sm:text-xl text-chalk/75 leading-relaxed">{lede}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </Container>
      <div className="kerb relative" aria-hidden="true" />
    </div>
  );
}
