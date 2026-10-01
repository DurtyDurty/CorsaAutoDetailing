import { appDarkColors } from "@shared/brand";

/** Signature dark theme. Colors come from the shared brand tokens. */
export const colors = appDarkColors;

export const fonts = {
  /** Barlow Condensed: headlines and big numbers, like the website. */
  display: "BarlowCondensed_800ExtraBold_Italic",
  displayUpright: "BarlowCondensed_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  /** JetBrains Mono: small uppercase labels. */
  mono: "JetBrainsMono_500Medium",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;

/** Apple's minimum comfortable touch target. */
export const MIN_TOUCH = 44;