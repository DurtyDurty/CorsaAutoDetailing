import Image from "next/image";
import Link from "next/link";
import { business } from "@/config/business";
import { cn } from "@/lib/utils";

/**
 * Brand mark. Uses the configured SVG logo when one is supplied, otherwise a
 * typographic wordmark so the site never shows a broken image.
 */
export function Wordmark({
  onDark = false,
  className,
  asLink = true,
}: {
  onDark?: boolean;
  className?: string;
  asLink?: boolean;
}) {
  const logo = onDark ? business.brand.logos.horizontalLight : business.brand.logos.horizontalDark;
  const inner = logo ? (
    <Image src={logo} alt={business.brand.name} width={180} height={40} priority className="h-9 w-auto" />
  ) : (
    <span className={cn("inline-flex items-baseline gap-2", onDark ? "text-ivory" : "text-charcoal")}>
      <span className="font-display text-[1.45rem] leading-none tracking-tight">Corsa</span>
      <span
        className={cn(
          "text-[0.68rem] font-semibold uppercase tracking-[0.22em] leading-none",
          onDark ? "text-champagne" : "text-champagne-deep",
        )}
      >
        Auto Detailing
      </span>
    </span>
  );
  if (!asLink) return <div className={className}>{inner}</div>;
  return (
    <Link href="/" className={cn("inline-flex items-center", className)} aria-label={`${business.brand.name} home`}>
      {inner}
    </Link>
  );
}
