import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOutRemote, useMe } from "@/api/queries";
import { DASHBOARD_URL } from "@/config";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { useSession } from "@/lib/session-store";

export default function MoreScreen() {
  const email = useSession((s) => s.session?.email);
  const { data: me } = useMe();
  const [busy, setBusy] = useState<"local" | "global" | null>(null);

  const signOut = (scope: "local" | "global") => {
    const everywhere = scope === "global";
    Alert.alert(
      everywhere ? "Sign out of every device?" : "Sign out?",
      everywhere ? "This also signs out the web dashboard and any other phone." : "You'll need your password to sign back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setBusy(scope);
            // Sign out locally even if the server can't be reached; the token expires on its own.
            await signOutRemote(scope).catch(() => undefined);
            await useSession.getState().signOutLocally();
            setBusy(null);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display" accessibilityRole="header">
          More
        </Text>

        <Card style={styles.card}>
          <Text variant="label">Signed in as</Text>
          <Text variant="bodyStrong">{email ?? me?.email ?? ""}</Text>
          {me && <Text variant="caption">{me.business.name} · {me.role === "owner" ? "Owner" : me.role}</Text>}
        </Card>

        <Card style={styles.card}>
          <Text variant="label">Web dashboard</Text>
          <Text variant="caption">Requests, messages and settings not yet in the app are on the dashboard.</Text>
          <Button label="Open dashboard" variant="secondary" onPress={() => void Linking.openURL(DASHBOARD_URL)} />
        </Card>

        <View style={styles.signOut}>
          <Button label="Sign out" variant="secondary" loading={busy === "local"} onPress={() => signOut("local")} fullWidth />
          <Button label="Sign out of all devices" variant="danger" loading={busy === "global"} onPress={() => signOut("global")} fullWidth />
        </View>

        <Text variant="caption" style={styles.version}>
          Corsa Owner {Constants.expoConfig?.version ?? ""}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl },
  card: { gap: space.sm },
  signOut: { gap: space.md },
  version: { textAlign: "center" },
});