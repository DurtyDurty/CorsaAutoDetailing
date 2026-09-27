import { business } from "@/config/business";
import { cn } from "@/lib/utils";

/** U.S. flag at the official 1.9:1 ratio: 13 stripes, canton over 7 stripes. Stars simplified for small sizes. */
function Flag({ className }: { className?: string }) {
  const stripe = 10 / 13;
  const stars: [number, number][] = [];
  for (let row = 0; row < 5; row++) {
    const cols = row % 2 === 0 ? 6 : 5;
    const offset = row % 2 === 0 ? 0.63 : 1.26;
    for (let c = 0; c < cols; c++) stars.push([offset + c * 1.26, 0.6 + row * 1.03]);
  }
  return (
    <svg viewBox="0 0 19 10" className={className} aria-hidden="true" focusable="false">
      <rect width="19" height="10" fill="#b22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={i * stripe} width="19" height={stripe} fill="#fff" />
      ))}
      <rect width="7.6" height={stripe * 7} fill="#3c3b6e" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.28" fill="#fff" />
      ))}
    </svg>
  );
}

/** "Veteran owned" badge with the U.S. flag. Renders nothing unless the owner has confirmed the claim. */
export function VeteranBadge({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  if (!business.owner.veteranOwned) return null;
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 rounded-sm border border-chalk/20 bg-asphalt/60 backdrop-blur text-chalk",
        size === "md" ? "px-3 py-2" : "px-2.5 py-1.5",
        className,
      )}
    >
      <Flag className={cn("shrink-0 rounded-[1px]", size === "md" ? "h-4 w-[30px]" : "h-3 w-[23px]")} />
      <span
        className={cn(
          "font-mono uppercase tracking-[0.16em] font-medium leading-none",
          size === "md" ? "text-[0.72rem]" : "text-[0.65rem]",
        )}
      >
        Veteran owned
      </span>
    </p>
  );
}
