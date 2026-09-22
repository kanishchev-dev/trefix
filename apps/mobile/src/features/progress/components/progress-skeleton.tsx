import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
};

export function ProgressSkeleton({ theme, themeMode }: Props) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const isDark = themeMode === "dark";

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacityAnim]);

  const skeletonBg = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.06)";

  return (
    <View style={styles.container}>
      {/* Period Selector Skeleton */}
      <View style={[styles.skeletonBar, { backgroundColor: theme.color.surface }]}>
        <Animated.View
          style={[
            styles.skeletonBlock,
            { backgroundColor: skeletonBg, opacity: opacityAnim, height: 32 },
          ]}
        />
      </View>

      {/* Form Overview Skeleton */}
      <View style={[styles.skeletonCard, { backgroundColor: theme.color.surface }]}>
        <Animated.View
          style={[
            styles.skeletonBlock,
            { backgroundColor: skeletonBg, opacity: opacityAnim, width: 120, height: 12, marginBottom: 16 },
          ]}
        />
        <View style={styles.row}>
          <Animated.View
            style={[
              styles.skeletonBlock,
              { backgroundColor: skeletonBg, opacity: opacityAnim, width: 100, height: 50 },
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonBlock,
              { backgroundColor: skeletonBg, opacity: opacityAnim, width: 120, height: 50 },
            ]}
          />
        </View>
      </View>

      {/* Capabilities Section Skeleton */}
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.gridCol}>
            <View style={[styles.skeletonCard, { backgroundColor: theme.color.surface }]}>
              <Animated.View
                style={[
                  styles.skeletonBlock,
                  { backgroundColor: skeletonBg, opacity: opacityAnim, height: 40 },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  skeletonBar: {
    padding: 6,
    borderRadius: 14,
  },
  skeletonCard: {
    padding: 20,
    borderRadius: 24,
  },
  skeletonBlock: {
    borderRadius: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    rowGap: 12,
  },
  gridCol: {
    width: "50%",
    paddingHorizontal: 6,
  },
});
