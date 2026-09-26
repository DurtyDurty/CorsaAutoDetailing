"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-bleed, muted, looping background video for the home hero.
 *
 * Footage: Pexels video 6157780 ("Black shiny car"), cropped to remove a studio
 * logo on the back wall and looped forward-then-reverse. Used under the Pexels
 * license as background mood only — it is NOT presented as our work. Replace
 * with owner footage when available (OWNER_DECISIONS.md).
 *
 * - Doesn't autoplay for visitors who prefer reduced motion (poster only).
 * - Visible pause/play control, since the loop runs longer than 5 seconds.
 * - Phones get the 360p file; everything else the 720p file.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false), // autoplay blocked (e.g. low-power mode): poster stays
    );
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true), () => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        poster="/media/hero-shine-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/media/hero-shine-360.mp4" type="video/mp4" media="(max-width: 640px)" />
        <source src="/media/hero-shine-720.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-5 right-5 z-20 inline-flex h-10 items-center gap-2 rounded-sm border border-chalk/25 bg-asphalt/60 px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-chalk/80 backdrop-blur hover:text-chalk hover:border-chalk/50"
        aria-label={playing ? "Pause background video" : "Play background video"}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" /> : <path d="M2.5 1l8 5-8 5z" />}
        </svg>
        {playing ? "Pause" : "Play"}
      </button>
    </>
  );
}
