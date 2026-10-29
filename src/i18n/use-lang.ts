"use client";

import { usePathname } from "next/navigation";
import { dict, langFromPath, type Dict, type Lang } from "./dictionary";

/** The page's language from its URL (/es/... is Spanish), for components shared by both languages. */
export function useLang(): { lang: Lang; d: Dict; pathname: string } {
  const pathname = usePathname() ?? "/";
  const lang = langFromPath(pathname);
  return { lang, d: dict(lang), pathname };
}
