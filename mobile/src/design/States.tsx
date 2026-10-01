import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";
import { space } from "./theme";

export function ErrorState({ message, onRetry, retrying }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text variant="heading">Couldn&apos;t load this</Text>
      <Text variant="caption" style={styles.center}>
        {message}
      </Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} loading={retrying} />}
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.box}>
      <Text variant="heading">{title}</Text>
      {detail && (
        <Text variant="caption" style={styles.center}>
          {detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.lg },
  center: { textAlign: "center" },
});