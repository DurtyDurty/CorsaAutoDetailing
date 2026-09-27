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
    <Image
      src={logo}
      alt={business.brand.name}
      width={1612}
      height={326}
      priority
      unoptimized
      className="h-8 sm:h-10 w-auto"
    />
  ) : (
    <span className={cn("inline-flex items-center gap-2.5", onDark ? "text-chalk" : "text-asphalt")}>
      <span className="flex gap-[3px] -skew-x-[20deg]" aria-hidden="true">
        <span className={cn("block h-5 w-[5px]", onDark ? "bg-apex" : "bg-apex-deep")} />
        <span className={cn("block h-5 w-[5px]", onDark ? "bg-apex/60" : "bg-apex-deep/60")} />
      </span>
      <span className="font-display italic font-extrabold text-[1.75rem] leading-none tracking-[0.01em]">Corsa</span>
      <span
        className={cn(
          "hidden min-[380px]:block lg:hidden xl:block whitespace-nowrap font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] leading-none pt-1",
          onDark ? "text-chalk/60" : "text-ink-muted",
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
