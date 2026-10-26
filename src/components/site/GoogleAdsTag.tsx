"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { business } from "@/config/business";
import { reportContactTap } from "@/lib/google-ads";

/**
 * The Google Ads tag on every public page (not /admin, quotes or invoices,
 * which live outside the site layout). Loads only when
 * NEXT_PUBLIC_GOOGLE_ADS_TAG_ID is set.
 *
 * - Page views: gtag's config sends the first; later client-side navigations
 *   send their own, since the page never reloads.
 * - Call/text taps: one listener catches every tel: and sms: link on the page,
 *   wherever it is (header, footer, sticky bar, contact page).
 */
export function GoogleAdsTag() {
  const tagId = business.analytics.googleAds.tagId;
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!tagId) return;
    if (first.current) {
      first.current = false;
      return;
    }
    window.gtag?.("event", "page_view", { send_to: tagId, page_location: window.location.href, page_path: pathname });
  }, [tagId, pathname]);

  useEffect(() => {
    if (!tagId) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href")?.toLowerCase() ?? "";
      if (href.startsWith("tel:")) reportContactTap("call");
      else if (href.startsWith("sms:")) reportContactTap("text");
    };
    // Capture phase, so it runs even if a link's own handler stops the event.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [tagId]);

  if (!tagId) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`} strategy="afterInteractive" />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(tagId)});`}
      </Script>
    </>
  );
}
