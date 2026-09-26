/**
 * Decorative hero graphic: a 90° corner with the classic
 * outside–inside–outside racing line clipping the apex kerb.
 * Purely illustrative — hidden from assistive tech.
 */
export function ApexLine({ className }: { className?: string }) {
  // Track centerline: up the entry straight, 150px-radius corner, out along the exit straight.
  const track = "M110 520 L110 260 A150 150 0 0 1 260 110 L560 110";
  // Racing line: wide on entry, touches the inner edge at the apex (200,200), wide on exit.
  const line = "M58 520 L58 360 C58 290 160 240 200 200 C240 160 290 58 340 58 L560 58";

  return (
    <svg
      viewBox="0 0 520 480"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      // Fade the track out at the bottom and right so it runs "off the map" instead of ending in a hard cut.
      style={{
        maskImage: "linear-gradient(to bottom, #000 72%, transparent), linear-gradient(to right, #000 78%, transparent)",
        maskComposite: "intersect",
        WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent), linear-gradient(to right, #000 78%, transparent)",
        WebkitMaskComposite: "source-in",
      }}
    >
      <defs>
        <filter id="apex-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Track edges + surface */}
      <path d={track} stroke="rgb(255 255 255 / 0.22)" strokeWidth="134" />
      <path d={track} stroke="#121418" strokeWidth="130" />
      <path d={track} stroke="rgb(255 255 255 / 0.10)" strokeWidth="1.5" strokeDasharray="14 18" />

      {/* Apex kerb on the inside of the corner */}
      <path d="M185.8 233 A79 79 0 0 1 233 185.8" stroke="#fff" strokeWidth="10" />
      <path d="M185.8 233 A79 79 0 0 1 233 185.8" stroke="#ff3b2f" strokeWidth="10" strokeDasharray="7 7" />

      {/* Racing line: glow, then the crisp line drawing in */}
      <path d={line} stroke="#ff3b2f" strokeWidth="10" opacity="0.35" filter="url(#apex-glow)" className="draw-line" style={{ ["--len" as string]: 900 }} />
      <path d={line} stroke="#ff3b2f" strokeWidth="3.5" strokeLinecap="round" className="draw-line" style={{ ["--len" as string]: 900 }} />

      {/* Markers */}
      <circle cx="58" cy="360" r="4" fill="#f3f3f1" />
      <circle cx="340" cy="58" r="4" fill="#f3f3f1" />
      <circle cx="200" cy="200" r="7" fill="#ff3b2f" className="apex-pulse" />
      <circle cx="200" cy="200" r="7" fill="#ff3b2f" stroke="#0c0d10" strokeWidth="2.5" />

      <g fontFamily="var(--font-code), ui-monospace, monospace" fontSize="12" letterSpacing="1.8" fill="rgb(243 243 241 / 0.6)">
        <text x="72" y="364">TURN-IN</text>
        <text x="228" y="252" fill="#ff3b2f" fontSize="14" fontWeight="500">APEX</text>
        <text x="352" y="84">EXIT</text>
        <text x="190" y="420" fill="rgb(243 243 241 / 0.35)">T1 · CLAY COUNTY</text>
      </g>
    </svg>
  );
}
