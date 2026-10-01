import { StyleSheet, View } from "react-native";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@shared/appointment-status";
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

export function StatusPill({ status }: { status: AppointmentStatus }) {
  const tone = TONE[status];
  const label = APPOINTMENT_STATUS_LABELS[status];
  return (
    <View style={[styles.pill, { borderColor: tone.color }]} accessible accessibilityLabel={`Status: ${label}`}>
      <Text style={[styles.text, { color: tone.color }]} importantForAccessibility="no-hide-descendants">
        {tone.glyph} {label}
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