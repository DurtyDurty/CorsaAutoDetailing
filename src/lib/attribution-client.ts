"use client";

import { mergeTouch, parseStoredTouch, STORAGE_KEY, touchFromUrl, type Touch } from "@/lib/attribution";

/**
 * Record this page view's campaign tags and ad click ids in first-party
 * storage and return the visitor's touch. Safe to call more than once per
 * page: merging is idempotent. Storage can be blocked (private mode), so
 * the current page's touch is still returned when it is.
 */
export function captureTouch(): Touch | null {
  const now = new Date();
  const current = touchFromUrl(window.location.href, document.referrer || null, now);
  let stored: Touch | null = null;
  try {
    stored = parseStoredTouch(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    /* storage unavailable */
  }
  const merged = mergeTouch(stored, current, now);
  try {
    if (merged) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  return merged;
}
