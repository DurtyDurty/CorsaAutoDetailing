import { dict, localePath, type Lang } from "@/i18n/dictionary";

/** Header and menu links: sections of the home page, in the page's language. */
export function navLinks(lang: Lang) {
  const d = dict(lang);
  const home = localePath(lang, "/");
  const at = (id: string) => (home === "/" ? `/#${id}` : `${home}#${id}`);
  return [
    { href: at("packages"), label: d.nav.packages },
    { href: at("corsa-club"), label: d.nav.club },
    { href: at("service-area"), label: d.nav.area },
    { href: at("faq"), label: d.nav.faq },
    { href: `${at("booking-form")}`, label: d.nav.book },
  ];
}

/** Other English pages, linked from the footer. */
export const MORE_PAGES = [
  { href: "/services", label: "Services & pricing" },
  { href: "/service-areas", label: "Service areas" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
