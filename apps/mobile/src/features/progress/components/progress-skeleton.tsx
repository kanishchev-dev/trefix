import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
};

export function ProgressSkeleton({ theme }: Props) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

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
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [opacityAnim]);

  const skeletonBg = theme.color.skeleton;

  return (
    <View style={styles.container}>
      {[0, 1, 2].map((section) => (
        <View key={section} style={styles.section}>
          <Animated.View
            style={[
              styles.block,
              {
                backgroundColor: skeletonBg,
                opacity: opacityAnim,
                width: 140,
                height: 18,
              },
            ]}
          />
          <View style={styles.row}>
            {[0, 1, 2].map((column) => (
              <View key={column} style={styles.column}>
                <Animated.View
                  style={[
                    styles.block,
                    {
                      backgroundColor: skeletonBg,
                      opacity: opacityAnim,
                      width: "60%",
                      height: 12,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.block,
                    {
                      backgroundColor: skeletonBg,
                      opacity: opacityAnim,
                      width: "80%",
                      height: 22,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <Animated.View
            style={[
              styles.block,
              { backgroundColor: skeletonBg, opacity: opacityAnim, height: 56 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
  section: {
    gap: 14,
  },
  block: {
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  column: {
    flex: 1,
    gap: 6,
  },
});
