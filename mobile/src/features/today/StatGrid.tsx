import { StyleSheet, View } from "react-native";
import type { TodaySummary } from "@shared/api";
import { formatCents } from "@shared/money";
import { Card } from "@/design/Card";
import { Text } from "@/design/Text";
import { space } from "@/design/theme";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
      <Text variant="label">{label}</Text>
      <Text variant="number">{value}</Text>
      {hint && <Text variant="caption">{hint}</Text>}
    </Card>
  );
}

export function StatGrid({ s }: { s: TodaySummary }) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Stat label="Booked today" value={formatCents(s.today.bookedCents)} hint={`${s.today.jobs} ${s.today.jobs === 1 ? "job" : "jobs"}`} />
        <Stat label="Still to collect" value={formatCents(s.today.outstandingCents)} hint={`${formatCents(s.today.collectedCents)} collected`} />
      </View>
      <View style={styles.row}>
        <Stat label="This week" value={formatCents(s.week.bookedCents)} hint={`${s.week.jobs} booked`} />
        <Stat label="This month" value={formatCents(s.month.bookedCents)} hint={`${s.month.jobs} booked`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, gap: space.xs },
});