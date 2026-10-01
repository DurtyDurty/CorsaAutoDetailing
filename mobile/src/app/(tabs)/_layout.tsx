import type { ColorValue } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useSummary } from "@/api/queries";
import { colors, fonts } from "@/design/theme";
import { Text } from "@/design/Text";

function Glyph({ char, color }: { char: string; color: ColorValue }) {
  return (
    <Text style={{ color, fontSize: 20, lineHeight: 24 }} importantForAccessibility="no">
      {char}
    </Text>
  );
}

/** Tabs appear as each area is built: Calendar and Customers come next. */
export default function TabsLayout() {
  const { data } = useSummary();
  const unread = data ? data.newRequests + data.unreadMessages : 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <Glyph char="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <Glyph char="✉" color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.text },
          tabBarAccessibilityLabel: unread > 0 ? `Inbox, ${unread} unread` : "Inbox",
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color }) => <Glyph char="≡" color={color} /> }} />
    </Tabs>
  );
}