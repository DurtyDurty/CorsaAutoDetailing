"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { WorkPhoto } from "@/config/photos";
import { cn } from "@/lib/utils";
import { LogoSlide } from "./LogoSlide";

export type HeroSlide = { type: "photo"; photo: WorkPhoto } | { type: "logo" };

/** How long each slide shows. The logo slide runs its whole animation once (globals.css, 3 s). */
const PHOTO_MS = 5500;
const LOGO_MS = 3000;

/**
 * Home hero slideshow: slides crossfade on their own while each photo slowly zooms. The bars at the
 * bottom fill as each slide plays (the filling bar's animation end is the timer, so pausing it pauses
 * everything) and jump to a slide when tapped. Pauses on hover, off screen, in a background tab, and
 * with the pause button. Reduced motion: no autoplay or zoom; the bars still switch slides.
 */
export function HeroSlideshow({ slides, label }: { slides: HeroSlide[]; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  // Bumped each time the logo slide comes up, so its animation starts from the muddy logo.
  const [logoLap, setLogoLap] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    if (root.current) io.observe(root.current);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  const carousel = slides.length > 1;
  const autoplay = !reduced;
  const running = autoplay && !userPaused && !hovered && inView && tabVisible;

  const show = (i: number) => {
    const next = (i + slides.length) % slides.length;
    if (next === active) return;
    setPrev(active);
    setActive(next);
    if (slides[next].type === "logo") setLogoLap((n) => n + 1);
  };

  return (
    <div
      ref={root}
      role={carousel ? "region" : undefined}
      aria-roledescription={carousel ? "carousel" : undefined}
      aria-label={carousel ? label : undefined}
      className="absolute inset-0 overflow-hidden bg-asphalt"
      // Mouse only: on touch screens a tap would "hover" and never leave, freezing the slideshow.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
    >
      {/* Announce slide changes only when the visitor is driving them. */}
      <div aria-live={running ? "off" : "polite"}>
        {slides.map((s, i) => {
          const isActive = i === active;
          const zooming = !reduced && (isActive || i === prev);
          return (
            <div
              key={s.type === "photo" ? s.photo.src : "logo"}
              role={carousel ? "group" : undefined}
              aria-roledescription={carousel ? "slide" : undefined}
              aria-label={carousel ? `${i + 1} of ${slides.length}` : undefined}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-out",
                isActive ? "z-10 opacity-100" : "z-0 opacity-0",
              )}
              onTransitionEnd={() => isActive && setPrev(null)}
            >
              {s.type === "photo" ? (
                <Image
                  src={s.photo.src}
                  alt={s.photo.alt}
                  fill
                  // The first photo loads right away (it's next after the logo), but only gets preload priority when it's
                  // the opening slide: behind the logo it would compete with the text that paints first.
                  priority={i === 0}
                  loading={slides.findIndex((x) => x.type === "photo") === i ? "eager" : undefined}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={cn("object-cover", zooming && "hero-kenburns")}
                  // Inline: the keyframe classes in globals.css are unlayered and would beat a utility class.
                  style={{
                    objectPosition: s.photo.focus ?? "center",
                    animationDuration: `${PHOTO_MS + 1500}ms`,
                    animationPlayState: running || !isActive ? "running" : "paused",
                  }}
                />
              ) : (
                <LogoSlide key={logoLap} active={isActive && (running || reduced)} />
              )}
            </div>
          );
        })}
      </div>

      {/* A single slide (the logo on its own) plays once and needs no controls. */}
      {carousel && (
        <>
          {/* Bottom shade so the controls read on bright photos. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-asphalt/70 to-asphalt/0" aria-hidden="true" />

          <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 px-5 pb-4 sm:px-8 lg:pb-6">
            <div className="flex flex-1 gap-1.5" role="group" aria-label="Choose a slide">
              {slides.map((s, i) => {
                const done = i < active;
                const current = i === active;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => show(i)}
                    aria-label={`Show slide ${i + 1}${s.type === "photo" ? `: ${s.photo.alt}` : ": Corsa logo animation"}`}
                    aria-current={current ? "true" : undefined}
                    className="group relative h-6 flex-1"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-chalk/30 group-hover:bg-chalk/50">
                      <span
                        key={current ? `run-${active}-${logoLap}` : "idle"}
                        className={cn(
                          "absolute inset-0 origin-left rounded-full bg-chalk",
                          current && autoplay && "hero-progress",
                          done || (current && !autoplay) ? "scale-x-100" : current ? "" : "scale-x-0",
                        )}
                        style={
                          current && autoplay
                            ? {
                                animationDuration: `${s.type === "logo" ? LOGO_MS : PHOTO_MS}ms`,
                                animationPlayState: running ? "running" : "paused",
                              }
                            : undefined
                        }
                        onAnimationEnd={() => current && autoplay && show(active + 1)}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {autoplay && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asphalt/60 text-chalk backdrop-blur hover:bg-asphalt/80"
              >
                {userPaused ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <path d="M3 1.5v11l9.5-5.5z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
