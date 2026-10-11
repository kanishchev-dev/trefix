import { StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

export function PlanSkeleton({ theme }: Props) {
  return (
    <View style={styles.container}>
      {/* Overview Card Skeleton */}
      <View
        style={[
          styles.cardSkeleton,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <View style={styles.skeletonRow}>
          <View
            style={[
              styles.skeletonBlock,
              { width: 140, height: 24, backgroundColor: theme.color.surface },
            ]}
          />
          <View
            style={[
              styles.skeletonBlock,
              {
                width: 70,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.color.surface,
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.skeletonBlock,
            { width: 120, height: 16, backgroundColor: theme.color.surface },
          ]}
        />

        <View style={{ gap: 8, marginTop: 8 }}>
          <View
            style={[
              styles.skeletonBlock,
              {
                width: "100%",
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.color.surface,
              },
            ]}
          />
        </View>
      </View>

      {/* Timeline Section Header Skeleton */}
      <View
        style={[
          styles.skeletonBlock,
          {
            width: 110,
            height: 14,
            marginBottom: 12,
            backgroundColor: theme.color.surfaceElevated,
          },
        ]}
      />

      {/* Timeline Skeleton Items */}
      <View style={{ gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.timelineItemSkeleton}>
            <View
              style={[
                styles.skeletonBlock,
                {
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: theme.color.surfaceElevated,
                },
              ]}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <View
                style={[
                  styles.skeletonBlock,
                  {
                    width: "40%",
                    height: 14,
                    backgroundColor: theme.color.surfaceElevated,
                  },
                ]}
              />
              <View
                style={[
                  styles.skeletonBlock,
                  {
                    width: "70%",
                    height: 18,
                    backgroundColor: theme.color.surfaceElevated,
                  },
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
  cardSkeleton: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
    marginBottom: 8,
  },
  skeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonBlock: {
    borderRadius: 8,
  },
  timelineItemSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
});
