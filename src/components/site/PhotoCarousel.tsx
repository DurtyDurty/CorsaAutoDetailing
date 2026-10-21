"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { WorkPhoto } from "@/config/photos";
import { cn } from "@/lib/utils";

/** One card: 4:5, about 1 per screen on phones (with the next peeking in), 2 on tablets, 3 on desktop. */
const SLIDE =
  "relative aspect-[4/5] w-[82%] shrink-0 snap-start overflow-hidden rounded-lg bg-chalk-deep sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]";

/**
 * Swipeable row of work photos: native scroll snapping (touch, trackpad, keyboard), plus arrow buttons
 * and dots. No autoplay. On phones the next photo peeks in so it's clear the row scrolls.
 * `lead` is an optional first card that isn't a photo (the animated logo).
 */
export function PhotoCarousel({ photos, label, lead }: { photos: WorkPhoto[]; label: string; lead?: ReactNode }) {
  const total = photos.length + (lead ? 1 : 0);
  const track = useRef<HTMLUListElement>(null);
  // A "position" is a scroll stop: with 3 photos in view (desktop) 5 photos give 3 positions, on phones 5.
  const [active, setActive] = useState(0);
  const [positions, setPositions] = useState(total);
  const [visible, setVisible] = useState(1);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    if (slides.length === 0) return;
    const step = slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : el.clientWidth;
    const gap = step - slides[0].offsetWidth;
    const inView = Math.max(1, Math.floor((el.clientWidth + gap + 2) / step));
    const stops = Math.max(1, slides.length - inView + 1);
    const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    setVisible(inView);
    setPositions(stops);
    setActive(end ? stops - 1 : Math.min(stops - 1, Math.round(el.scrollLeft / step)));
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(end);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[Math.max(0, Math.min(positions - 1, i))] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <ul
        ref={track}
        tabIndex={0}
        aria-label={`${label}: scroll sideways for more`}
        className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lead && (
          <li role="group" aria-roledescription="slide" aria-label={`1 of ${total}`} className={SLIDE}>
            {lead}
          </li>
        )}
        {photos.map((p, i) => (
          <li
            key={p.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1 + (lead ? 1 : 0)} of ${total}`}
            className={SLIDE}
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              sizes="(min-width: 1024px) 23rem, (min-width: 640px) 50vw, 82vw"
              className="object-cover"
              style={{ objectPosition: p.focus ?? "center" }}
            />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" aria-label="Choose photos" role="group">
          {Array.from({ length: positions }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={visible > 1 ? `Show ${i + 1} to ${i + visible}` : `Show ${i + 1} of ${total}`}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "h-2.5 rounded-full transition-[width,background-color] duration-300",
                i === active ? "w-7 bg-apex-deep" : "w-2.5 bg-line hover:bg-ink-muted",
              )}
            />
          ))}
          <span className="sr-only" aria-live="polite">
            {visible > 1
              ? `Showing ${active + 1} to ${active + visible} of ${total}`
              : `Showing ${active + 1} of ${total}`}
          </span>
        </div>
        <div className="flex gap-2">
          <ArrowButton direction="prev" disabled={atStart} onClick={() => goTo(active - 1)} />
          <ArrowButton direction="next" disabled={atEnd} onClick={() => goTo(active + 1)} />
        </div>
      </div>
    </div>
  );
}

function ArrowButton({ direction, disabled, onClick }: { direction: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous photo" : "Next photo"}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-asphalt text-asphalt transition-colors hover:bg-asphalt hover:text-chalk disabled:cursor-not-allowed disabled:border-line disabled:text-line disabled:hover:bg-transparent"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {direction === "prev" ? <path d="M15 9H4M8 4.5L3.5 9 8 13.5" /> : <path d="M3 9h11M10 4.5L14.5 9 10 13.5" />}
      </svg>
    </button>
  );
}
