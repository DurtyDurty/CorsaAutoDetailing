"use client";

import { useEffect, useRef, useState } from "react";
import { business } from "@/config/business";

/**
 * Brand card for the "Our work" carousel: the Corsa logo gets washed (mud melts off), then launches
 * away in a puff of smoke and brakes back into place. Animation lives in globals.css (`ls-*`).
 * Renders nothing without a logo file, since the mud is masked to the logo's shape.
 */
export function LogoSlide() {
  const logo = business.brand.logos.horizontalLight;
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  // Only animate while the card is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!logo) return null;
  return (
    <div
      ref={ref}
      data-playing={playing ? "" : undefined}
      className="logo-slide on-dark relative flex h-full flex-col overflow-hidden bg-asphalt text-chalk"
    >
      <div className="relative flex flex-1 items-center justify-center text-[clamp(1.5rem,6vw,2.25rem)]">
        {/* Smoke stays on the start line, at the back of the logo. */}
        <span aria-hidden="true" className="absolute left-[12%] top-[54%]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="ls-smoke" />
          ))}
        </span>
        <div className="ls-car w-[78%]">
          <div className="ls-logo" style={{ "--ls-logo": `url(${logo})` } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG used as-is (and as the mud mask) */}
            <img src={logo} alt={`${business.brand.name} logo`} width={1612} height={326} />
            <div aria-hidden="true">
              <span className="ls-dirt" />
              <span className="ls-shine-clip">
                <span className="ls-shine" />
              </span>
              <span className="ls-drip" />
              <span className="ls-drip" />
              <span className="ls-drip" />
            </div>
          </div>
        </div>
      </div>
      <p className="relative px-6 pb-5 text-xs font-semibold uppercase tracking-[0.14em] text-apex">
        {business.brand.tagline.replace(/\.$/, "")}
      </p>
      <div className="kerb relative h-1 shrink-0" aria-hidden="true" />
    </div>
  );
}
