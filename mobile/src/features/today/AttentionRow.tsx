import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { TodaySummary } from "@shared/api";
import { Text } from "@/design/Text";
import { colors, MIN_TOUCH, radius, space } from "@/design/theme";

function Item({ count, label }: { count: number; label: string }) {
  const active = count > 0;
  return (
    <View style={[styles.item, active && styles.itemActive]}>
      <Text variant="number" style={[styles.count, !active && styles.muted]}>
        {count}
      </Text>
      <Text variant="caption" style={!active ? styles.muted : undefined}>
        {label}
      </Text>
    </View>
  );
}

/** What's waiting on the owner; opens the Inbox. */
export function AttentionRow({ s }: { s: TodaySummary }) {
  const total = s.newRequests + s.unreadMessages + s.awaitingConfirmation;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Needs you: ${s.newRequests} new requests, ${s.unreadMessages} messages, ${s.awaitingConfirmation} awaiting confirmation. Opens the inbox.`}
      onPress={() => router.navigate("/inbox")}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text variant="label" style={total > 0 ? styles.alert : undefined}>
          {total > 0 ? "Needs you" : "All caught up"}
        </Text>
        <Text variant="caption">Open inbox ›</Text>
      </View>
      <View style={styles.row}>
        <Item count={s.newRequests} label="New requests" />
        <Item count={s.unreadMessages} label="Messages" />
        <Item count={s.awaitingConfirmation} label="To confirm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, minHeight: MIN_TOUCH },
  pressed: { opacity: 0.7 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alert: { color: colors.accent },
  row: { flexDirection: "row", gap: space.sm },
  item: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  itemActive: { borderColor: colors.accent },
  count: { fontSize: 26, lineHeight: 30 },
  muted: { color: colors.textMuted },
});