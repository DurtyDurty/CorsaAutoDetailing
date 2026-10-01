import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { colors, fonts, MIN_TOUCH, radius } from "./theme";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={[styles.item, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.sm, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  item: { flex: 1, minHeight: MIN_TOUCH - 4, alignItems: "center", justifyContent: "center", borderRadius: radius.sm - 2 },
  selected: { backgroundColor: colors.surfaceRaised },
  text: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted },
  textSelected: { color: colors.text },
});