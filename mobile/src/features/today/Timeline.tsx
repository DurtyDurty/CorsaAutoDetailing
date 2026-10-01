import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { AppointmentSummary } from "@shared/api";
import { Card } from "@/design/Card";
import { StatusPill } from "@/design/StatusPill";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { formatTime } from "@/lib/format";

export function Timeline({ items, focusId }: { items: AppointmentSummary[]; focusId: string | null }) {
  return (
    <Card style={styles.card}>
      {items.map((a, i) => (
        <Pressable
          key={a.id}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${formatTime(a.startsAt)}, ${a.customerName}, ${a.serviceName ?? "service not set"}. Opens the job.`}
          onPress={() => router.push({ pathname: "/appointment/[id]", params: { id: a.id } })}
        >
          <View style={styles.time}>
            <Text variant="bodyStrong" style={a.id === focusId ? styles.focus : undefined}>
              {formatTime(a.startsAt)}
            </Text>
          </View>
          <View style={styles.body}>
            <Text variant="bodyStrong">{a.customerName}</Text>
            <Text variant="caption">{a.serviceName ?? "Service not set"}</Text>
            <StatusPill status={a.status} />
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.sm },
  row: { flexDirection: "row", gap: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  time: { width: 76 },
  focus: { color: colors.accent },
  body: { flex: 1, gap: space.xs },
  pressed: { opacity: 0.6 },
});