export interface FaqItem {
  q: string;
  a: string;
}

/** Native disclosure widgets: keyboard-accessible, no JS. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line border-y-2 border-asphalt">
      {items.map((item) => (
        <details key={item.q} className="group py-1">
          <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none font-semibold text-lg hover:text-apex-deep [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              className="flex-none text-apex-deep transition-transform group-open:rotate-45"
            >
              <path d="M9 3v12M3 9h12" />
            </svg>
          </summary>
          <p className="pb-5 text-ink-muted leading-relaxed max-w-2xl">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
