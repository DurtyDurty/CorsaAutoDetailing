import { business } from "@/config/business";
import { localePath, stripLang, type Lang } from "./dictionary";

/** English paths that have a Spanish version under /es (the rest link to the Spanish home). */
export function hasSpanish(path: string): boolean {
  if (path === "/" || path === "/book") return true;
  if (path.startsWith("/thanks/")) return true;
  const town = /^\/service-areas\/([a-z-]+)$/.exec(path)?.[1];
  return Boolean(town && business.serviceAreas.communities.some((c) => c.slug === town && c.page));
}

/** Where the EN/ES toggle goes from `pathname`: the same page in the other language when it exists. */
export function otherLanguageHref(pathname: string, to: Lang): string {
  const base = stripLang(pathname);
  if (to === "es") return hasSpanish(base) ? localePath("es", base) : "/es";
  return base;
}

/** hreflang alternates for a page that exists in both languages. */
export function languageAlternates(path: string) {
  return {
    canonical: path,
    languages: { en: path, es: localePath("es", path), "x-default": path },
  };
}

export function spanishAlternates(path: string) {
  return {
    canonical: localePath("es", path),
    languages: { en: path, es: localePath("es", path), "x-default": path },
  };
}
