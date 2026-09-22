import { StyleSheet, Text, View } from "react-native";
import { Zap } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressTrainingImpact } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  impact: ProgressTrainingImpact;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function TrainingImpactCard({ impact, theme, themeMode, copy }: Props) {
  const isDark = themeMode === "dark";

  if (!impact || !impact.factors || impact.factors.length === 0) {
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
          <Zap size={15} color={theme.color.mutedForeground} strokeWidth={2.5} />
          <Text
            style={[
              styles.sectionHeader,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {copy.progress?.impact?.sectionTitle || "TRAINING IMPACT"}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.description,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {impact.description}
      </Text>

      {/* Factors Bars */}
      <View style={styles.factorsList}>
        {impact.factors.map((factor, idx) => (
          <View key={idx} style={styles.factorRow}>
            <View style={styles.factorHeader}>
              <Text
                style={[
                  styles.factorName,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {factor.name}
              </Text>
              <Text
                style={[
                  styles.factorPercent,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.bold,
                  },
                ]}
              >
                {factor.percentage}%
              </Text>
            </View>

            <View
              style={[
                styles.barTrack,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
                },
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(factor.percentage, 100)}%`,
                    backgroundColor: theme.color.foreground,
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
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  factorsList: {
    gap: 14,
  },
  factorRow: {
    gap: 6,
  },
  factorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  factorName: {
    fontSize: 14,
    lineHeight: 18,
  },
  factorPercent: {
    fontSize: 14,
    lineHeight: 18,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
});
