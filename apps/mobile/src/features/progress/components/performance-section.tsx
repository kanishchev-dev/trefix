import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Activity, Info } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type {
  ProgressPerformanceMetric,
  ProgressPerformanceMetricKey,
} from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { PerformanceChart } from "./performance-chart";

type Props = {
  metrics: ProgressPerformanceMetric[];
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function PerformanceSection({ metrics, theme, themeMode, copy }: Props) {
  const isDark = themeMode === "dark";

  const [activeKey, setActiveKey] = useState<ProgressPerformanceMetricKey>(
    metrics[0]?.metric || "pace"
  );

  const activeMetric =
    metrics.find((m) => m.metric === activeKey) || metrics[0];

  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Activity size={15} color={theme.color.mutedForeground} strokeWidth={2.5} />
          <Text
            style={[
              styles.sectionHeader,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {copy.progress?.performance?.sectionTitle || "PERFORMANCE TRENDS"}
          </Text>
        </View>
      </View>

      {/* Metric Chips Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {metrics.map((m) => {
          const isSelected = m.metric === activeKey;
          const translatedLabel =
            copy.progress?.performance?.metrics?.[m.metric] || m.title;

          return (
            <Pressable
              key={m.metric}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setActiveKey(m.metric)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? theme.color.foreground
                    : isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                  borderColor: isSelected
                    ? theme.color.foreground
                    : theme.color.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected
                      ? theme.color.primaryForeground
                      : theme.color.foreground,
                    fontFamily: isSelected
                      ? theme.typography.fontFamily.sans.bold
                      : theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {translatedLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Comparable Condition Note */}
      {activeMetric?.comparableContext ? (
        <View
          style={[
            styles.contextBox,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.04)"
                : "rgba(0, 0, 0, 0.03)",
              borderColor: theme.color.border,
            },
          ]}
        >
          <Info size={14} color={theme.color.mutedForeground} strokeWidth={2} />
          <Text
            style={[
              styles.contextText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {activeMetric.comparableContext}
          </Text>
        </View>
      ) : null}

      {/* Interactive Performance Chart */}
      {activeMetric ? (
        <PerformanceChart
          metric={activeMetric}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chipsRow: {
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 16,
  },
  contextBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginBottom: 12,
  },
  contextText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
