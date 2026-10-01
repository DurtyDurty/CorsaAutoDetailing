import { StyleSheet, View } from "react-native";
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
        <View
          key={a.id}
          style={[styles.row, i > 0 && styles.divider]}
          accessible
          accessibilityLabel={`${formatTime(a.startsAt)}, ${a.customerName}, ${a.serviceName ?? "service not set"}`}
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
        </View>
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
});