import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppointmentSummary } from "@shared/api";
import { useAppointments } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Skeleton } from "@/design/Skeleton";
import { EmptyState, ErrorState } from "@/design/States";
import { StatusPill } from "@/design/StatusPill";
import { Text } from "@/design/Text";
import { colors, fonts, MIN_TOUCH, radius, space } from "@/design/theme";
import { BUSINESS_TIME_ZONE } from "@/config";
import { formatTimeRange, vehicleLine } from "@/lib/format";

/** YYYY-MM-DD in Eastern time. */
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const keyOf = (d: Date) => dayKey.format(d);

/** Calendar-day arithmetic on YYYY-MM-DD strings (no time zone involved). */
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const asUtcNoon = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function mondayOf(key: string): string {
  const dow = asUtcNoon(key).getUTCDay();
  return addDays(key, -((dow + 6) % 7));
}

/** Hidden from the day list: called off. Their history is still on the job screen. */
const HIDDEN = new Set(["cancelled", "declined"]);

function JobRow({ a }: { a: AppointmentSummary }) {
  const vehicle = vehicleLine(a.vehicle);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatTimeRange(a.startsAt, a.endsAt)}, ${a.customerName}, ${a.serviceName ?? "service not set"}`}
      onPress={() => router.push({ pathname: "/appointment/[id]", params: { id: a.id } })}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card accent={a.status !== "held"} style={[styles.job, a.status === "held" && styles.held]}>
        <View style={styles.jobTop}>
          <Text variant="bodyStrong">{formatTimeRange(a.startsAt, a.endsAt)}</Text>
          <StatusPill status={a.status} />
        </View>
        <Text variant="heading">{a.customerName}</Text>
        <Text variant="caption">
          {a.serviceName ?? "Service not set"}
          {vehicle ? ` · ${vehicle}` : ""}
        </Text>
        {a.status === "held" && <Text style={styles.heldText}>To confirm: tap to confirm or decline</Text>}
      </Card>
    </Pressable>
  );
}

export default function CalendarScreen() {
  const today = keyOf(new Date());
  const [selected, setSelected] = useState(today);
  const weekStart = mondayOf(selected);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // A day of margin on each side covers any time-zone edge; rows are grouped by Eastern date.
  const from = `${addDays(weekStart, -1)}T00:00:00.000Z`;
  const to = `${addDays(weekStart, 8)}T00:00:00.000Z`;
  const { data, error, isPending, isRefetching, refetch } = useAppointments(from, to);

  const byDay = useMemo(() => {
    const m = new Map<string, AppointmentSummary[]>();
    for (const a of data ?? []) {
      if (HIDDEN.has(a.status)) continue;
      const k = keyOf(new Date(a.startsAt));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    for (const list of m.values()) list.sort((x, y) => x.startsAt.localeCompare(y.startsAt));
    return m;
  }, [data]);

  const jobs = byDay.get(selected) ?? [];
  const pick = (k: string) => {
    void Haptics.selectionAsync();
    setSelected(k);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text variant="display" accessibilityRole="header">
            Calendar
          </Text>
          <Button label="+ New" variant="secondary" onPress={() => router.push("/appointment/new")} />
        </View>

        <View style={styles.weekNav}>
          <Button label="‹" variant="ghost" accessibilityLabel="Previous week" onPress={() => pick(addDays(selected, -7))} />
          <Text variant="bodyStrong">{monthTitle.format(asUtcNoon(selected))}</Text>
          <View style={styles.weekNavRight}>
            {selected !== today && <Button label="Today" variant="ghost" onPress={() => pick(today)} />}
            <Button label="›" variant="ghost" accessibilityLabel="Next week" onPress={() => pick(addDays(selected, 7))} />
          </View>
        </View>

        <View style={styles.strip} accessibilityRole="tablist">
          {days.map((k) => {
            const on = k === selected;
            const count = byDay.get(k)?.length ?? 0;
            return (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${longDay.format(asUtcNoon(k))}, ${count} ${count === 1 ? "job" : "jobs"}${k === today ? ", today" : ""}`}
                onPress={() => pick(k)}
                style={[styles.day, on && styles.dayOn]}
              >
                <Text style={[styles.dayName, on && styles.dayTextOn]}>{weekday.format(asUtcNoon(k))}</Text>
                <Text style={[styles.dayNum, on && styles.dayTextOn, k === today && !on && styles.today]}>{dayNum.format(asUtcNoon(k))}</Text>
                <View style={[styles.dot, count > 0 && (on ? styles.dotOn : styles.dotHas)]} />
              </Pressable>
            );
          })}
        </View>

        <Text variant="label">{selected === today ? "Today" : longDay.format(asUtcNoon(selected))}</Text>
        {isPending ? (
          <View style={styles.list}>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </View>
        ) : error && !data ? (
          <ErrorState message={error.message} onRetry={() => void refetch()} retrying={isRefetching} />
        ) : jobs.length === 0 ? (
          <EmptyState title="No jobs" detail="Nothing booked this day." />
        ) : (
          <View style={styles.list}>
            {jobs.map((a) => (
              <JobRow key={a.id} a={a} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekNavRight: { flexDirection: "row" },
  strip: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minHeight: MIN_TOUCH + 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayOn: { backgroundColor: colors.text, borderColor: colors.text },
  dayName: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted },
  dayNum: { fontFamily: fonts.displayUpright, fontSize: 20, color: colors.text },
  dayTextOn: { color: colors.background },
  today: { color: colors.accent },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotHas: { backgroundColor: colors.accent },
  dotOn: { backgroundColor: colors.background },
  list: { gap: space.md },
  job: { gap: space.xs },
  held: { borderColor: colors.warning },
  heldText: { color: colors.warning, fontFamily: fonts.bodyMedium, fontSize: 13 },
  jobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  pressed: { opacity: 0.7 },
});
