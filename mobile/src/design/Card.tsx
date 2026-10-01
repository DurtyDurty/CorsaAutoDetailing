import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, space } from "./theme";

/** A raised graphite surface. `accent` adds the thin racing-red edge used for the current job. */
export function Card({ style, accent = false, ...rest }: ViewProps & { accent?: boolean }) {
  return <View style={[styles.card, accent && styles.accent, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.lg,
  },
  accent: { borderLeftWidth: 3, borderLeftColor: colors.accent },
});