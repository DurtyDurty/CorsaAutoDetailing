/**
 * Corsa brand tokens, shared by the website and the owner app.
 */

/** Exactly the website's Tailwind theme (src/app/globals.css). */
export const webColors = {
  asphalt: "#0c0d10",
  asphaltSoft: "#17191e",
  chalk: "#f3f3f1",
  chalkDeep: "#e6e6e2",
  apex: "#ff3b2f",
  apexDeep: "#c8150b",
  ink: "#0c0d10",
  inkMuted: "#53565c",
  line: "#d5d5d0",
  lineDark: "#2a2d34",
  success: "#2f6b3a",
  error: "#b3261e",
} as const;

/**
 * The owner app's dark theme: built on the website's asphalt and apex, with
 * raised graphite surfaces. Status colors are lighter than the website's so
 * they stay readable on dark backgrounds, and error is a different red from
 * the brand accent so a problem never looks like branding.
 */
export const appDarkColors = {
  background: webColors.asphalt,
  surface: webColors.asphaltSoft,
  surfaceRaised: "#1f2228",
  border: webColors.lineDark,
  text: webColors.chalk,
  textMuted: "#9aa0ab",
  accent: webColors.apex,
  accentPressed: webColors.apexDeep,
  success: "#4fb37a",
  warning: "#e0a63a",
  error: "#ff6b81",
} as const;
