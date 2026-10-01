import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors, fonts, MIN_TOUCH, radius, space } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Stronger haptic for actions that change a job. */
  haptic?: "light" | "medium" | "none";
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = "primary", loading = false, haptic = "light", icon, fullWidth, disabled, onPress, style, ...rest }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={6}
      onPress={(e) => {
        if (haptic !== "none") {
          void Haptics.impactAsync(haptic === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles[`${variant}Pressed`],
        inactive && styles.inactive,
        style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.text : colors.accent} /> : icon}
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  fullWidth: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 15, letterSpacing: 0.6, textTransform: "uppercase", color: colors.text },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed, borderColor: colors.accentPressed },
  secondary: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  secondaryPressed: { backgroundColor: colors.border },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  ghostPressed: { backgroundColor: colors.surfaceRaised },
  danger: { backgroundColor: "transparent", borderColor: colors.error },
  dangerPressed: { backgroundColor: colors.surfaceRaised },
  inactive: { opacity: 0.5 },
});