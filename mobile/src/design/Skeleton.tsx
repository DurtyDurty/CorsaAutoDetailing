import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue } from "react-native";
import { colors, radius } from "./theme";

/** Placeholder block while data loads. Pulses unless Reduce Motion is on. */
export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: DimensionValue }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <View style={{ width, height }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.block, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
});