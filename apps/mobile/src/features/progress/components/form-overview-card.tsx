import { StyleSheet, Text, View } from "react-native";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressForm } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  form: ProgressForm;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function FormOverviewCard({ form, theme, themeMode, copy }: Props) {
  const isDark = themeMode === "dark";

  // Translate form status (BUILDING -> "Building" / "Набор формы")
  const statusKey = form.status;
  const statusLabel =
    copy.progress?.form?.statuses?.[statusKey] ||
    statusKey.replace("_", " ");

  const trendText =
    form.trend === "IMPROVING"
      ? copy.progress?.form?.improving || "Improving"
      : form.trend === "DECLINING"
        ? copy.progress?.form?.declining || "Declining"
        : copy.progress?.form?.stable || "Stable";

  const comparisonText =
    copy.progress?.form?.comparisonText?.replace(
      "{{change}}",
      String(form.change)
    ) || `+${form.change} compared with 6 weeks ago`;

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
      <Text
        style={[
          styles.sectionHeader,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.bold,
          },
        ]}
      >
        {copy.progress?.form?.sectionTitle || "CURRENT FORM"}
      </Text>

      {/* Primary Form Score & Status */}
      <View style={styles.mainRow}>
        <View style={styles.scoreWrap}>
          <Text
            style={[
              styles.primaryScore,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {form.form >= 0 ? `${form.form}` : `${form.form}`}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(9, 9, 11, 0.06)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {statusLabel.toUpperCase()} FORM
            </Text>
          </View>
        </View>

        {/* Secondary Fitness / Fatigue / Form Columns */}
        <View style={styles.metricsCol}>
          <View style={styles.metricRow}>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {copy.progress?.form?.fitness || "Fitness"}
            </Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {form.fitness}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {copy.progress?.form?.fatigue || "Fatigue"}
            </Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {form.fatigue}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {copy.progress?.form?.form || "Form"}
            </Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {form.form > 0 ? `+${form.form}` : form.form}
            </Text>
          </View>
        </View>
      </View>

      {/* Trend & Comparison */}
      <View
        style={[
          styles.trendFooter,
          {
            borderTopColor: theme.color.border,
          },
        ]}
      >
        <View style={styles.trendIconWrap}>
          {form.trend === "IMPROVING" ? (
            <TrendingUp size={16} color={theme.color.foreground} strokeWidth={2.5} />
          ) : form.trend === "DECLINING" ? (
            <TrendingDown size={16} color={theme.color.mutedForeground} strokeWidth={2.5} />
          ) : (
            <Minus size={16} color={theme.color.mutedForeground} strokeWidth={2.5} />
          )}
          <Text
            style={[
              styles.trendText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {trendText}
          </Text>
        </View>
        <Text
          style={[
            styles.comparisonText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {comparisonText}
        </Text>
      </View>
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
  sectionHeader: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  scoreWrap: {
    alignItems: "flex-start",
  },
  primaryScore: {
    fontSize: 54,
    lineHeight: 60,
    letterSpacing: -2,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  metricsCol: {
    width: 130,
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  metricValue: {
    fontSize: 15,
    lineHeight: 18,
  },
  trendFooter: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  trendIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendText: {
    fontSize: 13,
    lineHeight: 16,
  },
  comparisonText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
