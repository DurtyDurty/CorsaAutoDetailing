import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSummary } from "@/api/queries";
import { Button } from "@/design/Button";
import { Skeleton } from "@/design/Skeleton";
import { EmptyState, ErrorState } from "@/design/States";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { AttentionRow } from "@/features/today/AttentionRow";
import { ConfirmCard } from "@/features/today/ConfirmCard";
import { FocusCard } from "@/features/today/FocusCard";
import { StatGrid } from "@/features/today/StatGrid";
import { Timeline } from "@/features/today/Timeline";
import { formatLongDate, formatShortDay, formatTime, greeting } from "@/lib/format";

export default function TodayScreen() {
  const { data, error, isPending, isRefetching, refetch, dataUpdatedAt } = useSummary();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text variant="label">{formatLongDate(new Date())}</Text>
          <Text variant="display" accessibilityRole="header">
            {greeting()}
          </Text>
          <Button label="+ New appointment" variant="secondary" onPress={() => router.push("/appointment/new")} />
        </View>

        {isPending ? (
          <View style={styles.section}>
            <Skeleton height={190} />
            <Skeleton height={96} />
            <Skeleton height={96} />
          </View>
        ) : !data ? (
          <ErrorState message={error?.message ?? "Something went wrong."} onRetry={() => void refetch()} retrying={isRefetching} />
        ) : (
          <>
            {error && (
              <Text variant="caption" style={styles.stale} accessibilityRole="alert">
                Can&apos;t reach the server. Showing the last update from {formatTime(new Date(dataUpdatedAt).toISOString())}.
              </Text>
            )}

            {data.toConfirm.length > 0 && (
              <View style={styles.section}>
                <Text variant="label" style={styles.stale}>
                  To confirm ({data.toConfirm.length})
                </Text>
                {data.toConfirm.map((a) => (
                  <ConfirmCard key={a.id} appt={a} />
                ))}
              </View>
            )}

            {data.focus ? (
              <FocusCard appt={data.focus} isToday />
            ) : (
              <EmptyState
                title={data.timeline.length > 0 ? "Done for today" : "No jobs today"}
                detail={
                  data.nextJob
                    ? `Next job: ${formatShortDay(data.nextJob.startsAt)} at ${formatTime(data.nextJob.startsAt)}, ${data.nextJob.customerName} (${data.nextJob.serviceName ?? "service not set"}).`
                    : "Nothing booked yet. New website requests appear here to confirm."
                }
              />
            )}

            <AttentionRow s={data} />
            <StatGrid s={data} />

            <View style={styles.section}>
              <Text variant="label">Today&apos;s schedule</Text>
              {data.timeline.length > 0 ? (
                <Timeline items={data.timeline} focusId={data.focus?.id ?? null} />
              ) : (
                <Text variant="caption">No jobs today.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl },
  header: { gap: space.sm },
  section: { gap: space.md },
  stale: { color: colors.warning },
});