import { StyleSheet, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

const SIZES = {
  /** Corner of a Today card. */
  // Sits a bit lower than the step heights suggest so the tallest one clears the status box.
  card: { width: 22, gap: 10, heights: [64, 98, 132], right: 22, bottom: -40 },
  /** Top block of the workout screen. */
  hero: {
    width: 34,
    gap: 14,
    heights: [120, 180, 240],
    right: 28,
    bottom: -64,
  },
} as const;

type Props = {
  theme: ThemeTokens;
  level: number;
  size: keyof typeof SIZES;
  dimmed?: boolean;
};

/**
 * Intensity scale: three slanted steps rising like signal bars, lit from the
 * faintest to the strongest. Sits in the bottom-right corner of its container and
 * is cut by its edge. Decorative for screen readers: the level is always in text.
 */
export function IntensityScale({ theme, level, size, dimmed = false }: Props) {
  const spec = SIZES[size];
  const lit = [
    theme.color.intensity1,
    theme.color.intensity2,
    theme.color.intensity3,
  ];

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.root,
        { right: spec.right, bottom: spec.bottom, gap: spec.gap },
        dimmed && styles.dimmed,
      ]}
    >
      {spec.heights.map((height, index) => (
        <View
          key={height}
          style={[
            styles.step,
            {
              width: spec.width,
              height,
              backgroundColor:
                index < level ? lit[index] : theme.color.intensityOff,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** The same scale in miniature, inline next to text (session steps). */
export function IntensityMeter({
  theme,
  level,
}: {
  theme: ThemeTokens;
  level: number;
}) {
  const lit = [
    theme.color.intensity1,
    theme.color.intensity2,
    theme.color.intensity3,
  ];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.meter}
    >
      {[9, 14, 19].map((height, index) => (
        <View
          key={height}
          style={[
            styles.meterStep,
            {
              height,
              backgroundColor:
                index < level ? lit[index] : theme.color.intensityOff,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  dimmed: {
    opacity: 0.4,
  },
  step: {
    borderRadius: 3,
    transform: [{ skewX: "-24deg" }],
  },
  meter: {
    height: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  meterStep: {
    width: 5,
    borderRadius: 1,
    transform: [{ skewX: "-24deg" }],
  },
});
