/**
 * Where a visitor came from, captured on the page they land on and carried to
 * the booking form. Pure TypeScript, used in the browser and on the server.
 *
 * Only known campaign parameters are read; the rest of the query string is
 * ignored, so personal data in a URL can't end up stored. Nothing here
 * identifies a person: Google click ids identify an ad click, not a customer.
 */

export interface Touch {
  /** Path of the first page seen, without the query string. */
  landingPath: string | null;
  /** Referring site's host only. */
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  /** Google Ads click ids (auto-tagging). The latest ad click wins. */
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  /** ISO time the first touch was captured. */
  firstSeenAt: string;
  /** ISO time of the ad click the click ids above came from. */
  clickSeenAt: string | null;
}

/** Google accepts conversions up to 90 days after the click; older touches are dropped. */
export const TOUCH_MAX_AGE_DAYS = 90;
export const STORAGE_KEY = "corsa_touch_v1";

const CLICK_ID = /^[A-Za-z0-9_\-.]{10,250}$/;
const UTM_MAX = 120;

/** Click ids are opaque tokens; anything that doesn't look like one is dropped. */
export function cleanClickId(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s && CLICK_ID.test(s) ? s : null;
}

/** Campaign tags: printable text, no email addresses or phone-like digit runs, capped length. */
export function cleanTag(v: string | null | undefined): string | null {
  const s = v?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, UTM_MAX);
  if (!s) return null;
  if (s.includes("@") || /\d{7,}/.test(s.replace(/[\s().\-+]/g, ""))) return null;
  return s;
}

export function cleanPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const path = p.split(/[?#]/)[0].slice(0, 200);
  return path.startsWith("/") ? path : null;
}

export function cleanReferrer(r: string | null | undefined): string | null {
  if (!r) return null;
  try {
    return new URL(r).host.slice(0, 120) || null;
  } catch {
    return null;
  }
}

/** The touch described by one page view. Returns null when the visit carries nothing worth keeping. */
export function touchFromUrl(href: string, referrer: string | null, now: Date, ownHost?: string): Touch | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const q = url.searchParams;
  const ref = cleanReferrer(referrer);
  const touch: Touch = {
    landingPath: cleanPath(url.pathname),
    // A click from one of our own pages isn't a source.
    referrer: ref && ref !== (ownHost ?? url.host) ? ref : null,
    utmSource: cleanTag(q.get("utm_source")),
    utmMedium: cleanTag(q.get("utm_medium")),
    utmCampaign: cleanTag(q.get("utm_campaign")),
    utmTerm: cleanTag(q.get("utm_term")),
    utmContent: cleanTag(q.get("utm_content")),
    gclid: cleanClickId(q.get("gclid")),
    gbraid: cleanClickId(q.get("gbraid")),
    wbraid: cleanClickId(q.get("wbraid")),
    firstSeenAt: now.toISOString(),
    clickSeenAt: null,
  };
  if (hasClickId(touch)) touch.clickSeenAt = touch.firstSeenAt;
  return touch;
}

export function hasClickId(t: { gclid?: string | null; gbraid?: string | null; wbraid?: string | null }): boolean {
  return Boolean(t.gclid || t.gbraid || t.wbraid);
}

function isFresh(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now.getTime() - t <= TOUCH_MAX_AGE_DAYS * 86_400_000 && t <= now.getTime() + 60_000;
}

/**
 * Combine what's stored with this page view. The first touch (landing page,
 * referrer, UTM tags, timestamp) is kept as it was; a newer Google ad click
 * replaces the stored click ids, since that's the click a booking follows.
 * Expired touches are discarded.
 */
export function mergeTouch(stored: Touch | null, current: Touch | null, now: Date): Touch | null {
  const keep = stored && isFresh(stored.firstSeenAt, now) ? stored : null;
  if (!keep) return current;
  if (!current || !hasClickId(current)) {
    // Drop click ids that have aged out even if the first touch hasn't.
    return hasClickId(keep) && !isFresh(keep.clickSeenAt, now)
      ? { ...keep, gclid: null, gbraid: null, wbraid: null, clickSeenAt: null }
      : keep;
  }
  return { ...keep, gclid: current.gclid, gbraid: current.gbraid, wbraid: current.wbraid, clickSeenAt: current.clickSeenAt };
}

/** Parse a stored touch, rejecting anything malformed (storage is user-controlled). */
export function parseStoredTouch(raw: string | null): Touch | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || typeof o.firstSeenAt !== "string" || !Number.isFinite(Date.parse(o.firstSeenAt))) return null;
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
    return {
      landingPath: cleanPath(str("landingPath")),
      referrer: cleanReferrer(str("referrer") ? `https://${str("referrer")}` : null),
      utmSource: cleanTag(str("utmSource")),
      utmMedium: cleanTag(str("utmMedium")),
      utmCampaign: cleanTag(str("utmCampaign")),
      utmTerm: cleanTag(str("utmTerm")),
      utmContent: cleanTag(str("utmContent")),
      gclid: cleanClickId(str("gclid")),
      gbraid: cleanClickId(str("gbraid")),
      wbraid: cleanClickId(str("wbraid")),
      firstSeenAt: o.firstSeenAt,
      clickSeenAt: str("clickSeenAt") && Number.isFinite(Date.parse(str("clickSeenAt")!)) ? str("clickSeenAt") : null,
    };
  } catch {
    return null;
  }
}

/** The form fields a touch fills (FormMeta hidden inputs). */
export const TOUCH_FIELDS = [
  "landingPath",
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "gclid",
  "gbraid",
  "wbraid",
  "firstSeenAt",
  "clickSeenAt",
] as const satisfies readonly (keyof Touch)[];

/** True when the touch came from a Google Ads click (auto-tagged or tagged as paid Google). */
export function isGoogleAds(s: { gclid?: string | null; gbraid?: string | null; wbraid?: string | null; utmSource?: string | null; utmMedium?: string | null }): boolean {
  if (s.gclid || s.gbraid || s.wbraid) return true;
  const src = s.utmSource?.toLowerCase();
  const med = s.utmMedium?.toLowerCase();
  return src === "google" && (med === "cpc" || med === "ppc" || med === "paid" || med === "paidsearch");
}
