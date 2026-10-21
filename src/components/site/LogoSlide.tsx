"use client";

import { useEffect, useRef, useState } from "react";
import { business } from "@/config/business";

/**
 * Brand slide for the home hero slideshow: the Corsa logo gets washed (mud melts off), then launches
 * away in a puff of smoke and brakes back into place. Animation lives in globals.css (`ls-*`) and only
 * runs while the slide is the active one and on screen; remount it (new `key`) to start from the mud.
 * Renders nothing without a logo file, since the mud is masked to the logo's shape.
 */
export function LogoSlide({ active }: { active: boolean }) {
  const logo = business.brand.logos.horizontalLight;
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!logo) return null;
  return (
    <div
      ref={ref}
      data-playing={active && inView ? "" : undefined}
      className="logo-slide on-dark relative flex h-full items-center justify-center overflow-hidden bg-asphalt text-[clamp(1.5rem,5vw,2.5rem)] text-chalk"
    >
      {/* Smoke stays on the start line, at the back of the logo. */}
      <span aria-hidden="true" className="absolute left-[12%] top-[54%]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="ls-smoke" />
        ))}
      </span>
      <div className="ls-car w-[74%] max-w-xl">
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
  );
}
