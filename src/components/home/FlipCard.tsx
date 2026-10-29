"use client";

import { useState } from "react";
import Image from "next/image";
import type { WorkPhoto } from "@/config/photos";

/**
 * One before/after pair as a card that flips when tapped (a button, so keyboards and screen readers can use
 * it too). The global reduced-motion rule turns the flip into an instant swap.
 */
export function FlipCard({
  before,
  after,
  caption,
  labels,
}: {
  before: WorkPhoto;
  after: WorkPhoto;
  caption: string;
  /** `flip` is the button's accessible name, already including the caption. */
  labels: { before: string; after: string; flip: string };
}) {
  const [showAfter, setShowAfter] = useState(false);
  const side = (p: WorkPhoto, back: boolean) => (
    <div
      className="absolute inset-0 overflow-hidden rounded-lg [backface-visibility:hidden]"
      style={back ? { transform: "rotateY(180deg)" } : undefined}
      aria-hidden={back ? !showAfter : showAfter}
    >
      <Image
        src={p.src}
        alt={p.alt}
        fill
        loading="lazy"
        sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
        className="object-cover"
        style={{ objectPosition: p.focus ?? "center" }}
      />
    </div>
  );
  return (
    <figure>
      <button
        type="button"
        aria-pressed={showAfter}
        aria-label={labels.flip}
        onClick={() => setShowAfter((v) => !v)}
        className="group relative block aspect-[4/5] w-full [perspective:1200px]"
      >
        <span
          className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: showAfter ? "rotateY(180deg)" : "none" }}
        >
          {side(before, false)}
          {side(after, true)}
        </span>
        <span className="absolute bottom-3 left-3 z-10 rounded-full bg-night/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-chalk">
          {showAfter ? labels.after : labels.before}
          <span aria-hidden="true" className="ml-2 text-apex">
            ⟲
          </span>
        </span>
      </button>
      <figcaption className="mt-2.5 text-sm text-chalk/75">{caption}</figcaption>
    </figure>
  );
}
