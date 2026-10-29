import { business, shownReviews } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { cn } from "@/lib/utils";
import { Flag } from "./VeteranBadge";

/**
 * The short reasons to trust us, as a row of chips near the top of the home and /book pages
 * (visible on a phone without scrolling). Only true, owner-confirmed claims; the review chip waits
 * until the reviews section itself is shown.
 */
export function TrustPoints({ className, lang = "en" }: { className?: string; lang?: Lang }) {
  const reviews = shownReviews();
  const fiveStarGoogle = reviews.length > 0 && reviews.every((r) => r.rating === 5 && r.source === "Google");
  const es = lang === "es";
  const chip = "inline-flex items-center gap-2 rounded-full border border-chalk/20 bg-chalk/5 px-3 py-1.5 text-[0.8rem] font-medium text-chalk";
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label={es ? "Por qué Corsa" : "Why Corsa"}>
      {business.owner.veteranOwned && (
        <li className={chip}>
          <Flag className="h-3 w-[23px] shrink-0 rounded-[1px]" />
          {es ? "De un veterano" : "Veteran-owned"}
        </li>
      )}
      <li className={chip}>
        <span lang="es">Se habla español</span>
      </li>
      <li className={chip}>{dict(lang).why.tiles.contained.title}</li>
      {fiveStarGoogle && (
        <li className={chip}>
          <span className="text-apex" aria-hidden="true">
            ★★★★★
          </span>
          <span>{es ? "5 estrellas en Google" : "5-star Google reviews"}</span>
        </li>
      )}
    </ul>
  );
}
