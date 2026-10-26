import { business } from "@/config/business";
import { cn } from "@/lib/utils";
import { Flag } from "./VeteranBadge";

/**
 * The short reasons to trust us, as a row of chips near the top of the home and /book pages
 * (visible on a phone without scrolling). Only true, owner-confirmed claims.
 */
export function TrustPoints({ className }: { className?: string }) {
  const reviews = business.testimonials;
  const fiveStarGoogle = reviews.length > 0 && reviews.every((r) => r.rating === 5 && r.source === "Google");
  const chip = "inline-flex items-center gap-2 rounded-sm border border-chalk/20 bg-chalk/5 px-2.5 py-1.5 text-[0.8rem] font-medium text-chalk";
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Why Corsa">
      {business.owner.veteranOwned && (
        <li className={chip}>
          <Flag className="h-3 w-[23px] shrink-0 rounded-[1px]" />
          Veteran-owned
        </li>
      )}
      <li className={chip}>
        <span lang="es">Se habla español</span>
      </li>
      {fiveStarGoogle && (
        <li className={chip}>
          <span className="text-apex" aria-hidden="true">
            ★★★★★
          </span>
          <span>5-star Google reviews</span>
        </li>
      )}
    </ul>
  );
}
