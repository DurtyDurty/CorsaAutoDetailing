import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, fonts } from "./theme";

type Variant = "display" | "title" | "heading" | "body" | "bodyStrong" | "label" | "caption" | "number";

const styles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.text, textTransform: "uppercase" },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.text, textTransform: "uppercase" },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: colors.text },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, color: colors.textMuted, textTransform: "uppercase" },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  number: { fontFamily: fonts.displayUpright, fontSize: 30, lineHeight: 34, color: colors.text },
};

export function Text({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  // Dynamic Type stays on; very large sizes are capped so layouts don't break.
  return <RNText maxFontSizeMultiplier={1.6} style={[styles[variant], style]} {...rest} />;
}