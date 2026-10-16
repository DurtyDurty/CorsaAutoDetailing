import { StyleSheet, View } from "react-native";
import { statusLabel, type AppointmentStatus } from "@shared/appointment-status";
import { Text } from "./Text";
import { colors, fonts, radius, space } from "./theme";

/** Shape + text carry the meaning; color only reinforces it. */
const TONE: Record<AppointmentStatus, { color: string; glyph: string }> = {
  held: { color: colors.warning, glyph: "◷" },
  confirmed: { color: colors.text, glyph: "●" },
  en_route: { color: colors.accent, glyph: "➤" },
  arrived: { color: colors.accent, glyph: "◉" },
  in_progress: { color: colors.accent, glyph: "▶" },
  completed: { color: colors.success, glyph: "✓" },
  cancelled: { color: colors.textMuted, glyph: "✕" },
  no_show: { color: colors.error, glyph: "!" },
  declined: { color: colors.textMuted, glyph: "✕" },
};

/** A held job's pill says where its quote stands (pass the latest quote's status). */
export function StatusPill({ status, quoteStatus }: { status: AppointmentStatus; quoteStatus?: string | null }) {
  const tone = TONE[status];
  const label = statusLabel(status, quoteStatus);
  const glyph = status === "held" && quoteStatus === "sent" ? "✉" : tone.glyph;
  return (
    <View style={[styles.pill, { borderColor: tone.color }]} accessible accessibilityLabel={`Status: ${label}`}>
      <Text style={[styles.text, { color: tone.color }]} importantForAccessibility="no-hide-descendants">
        {glyph} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  text: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
});