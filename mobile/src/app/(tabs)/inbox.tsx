import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ConversationSummary } from "@shared/api";
import { useConversations } from "@/api/queries";
import { Segmented } from "@/design/Segmented";
import { Skeleton } from "@/design/Skeleton";
import { EmptyState, ErrorState } from "@/design/States";
import { Text } from "@/design/Text";
import { colors, fonts, MIN_TOUCH, radius, space } from "@/design/theme";
import { formatWhen } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

const KIND_LABEL: Record<ConversationSummary["kind"], string> = {
  contact: "Message",
  quote_request: "Request",
  launch_list: "Launch list",
  membership_interest: "Plan interest",
};

function Row({ c }: { c: ConversationSummary }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.unread ? "Unread. " : ""}${c.customerName}, ${KIND_LABEL[c.kind]}, ${c.preview}${c.lastSendFailed ? ". Last email failed to send" : ""}`}
      onPress={() => router.push({ pathname: "/conversation/[leadId]", params: { leadId: c.leadId } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.dot, c.unread && styles.dotOn]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text variant={c.unread ? "bodyStrong" : "body"} numberOfLines={1} style={styles.name}>
            {c.customerName}
          </Text>
          <Text variant="caption">{formatWhen(c.lastActivityAt)}</Text>
        </View>
        <Text variant="label" style={c.unread ? styles.kindUnread : undefined}>
          {KIND_LABEL[c.kind]}
          {c.lastSendFailed ? "  ·  ! Not sent" : ""}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {c.preview}
        </Text>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const query = useConversations(filter, q);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          Inbox
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email, vehicle…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search conversations"
        />
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
      </View>

      {query.isPending ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </View>
      ) : query.isError && items.length === 0 ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.leadId}
          renderItem={({ item }) => <Row c={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.more} /> : null}
          ListEmptyComponent={
            <EmptyState
              title={q ? "No matches" : filter === "unread" ? "All caught up" : "No conversations yet"}
              detail={q ? "Try a different name, email or vehicle." : filter === "unread" ? "New website messages and requests appear here." : undefined}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md, gap: space.md },
  search: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.md, minHeight: MIN_TOUCH },
  pressed: { opacity: 0.6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  dotOn: { backgroundColor: colors.accent },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  name: { flex: 1 },
  kindUnread: { color: colors.accent },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  more: { marginVertical: space.lg },
});