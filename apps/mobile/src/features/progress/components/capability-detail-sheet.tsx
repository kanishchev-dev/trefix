import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles, CheckCircle2 } from "lucide-react-native";
import type { ThemeMode, ThemeTokens } from "@workspace/tokens";
import type { ProgressCapability } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { BottomSheet, SheetSectionLabel } from "../../../shared/ui/bottom-sheet";

type Props = {
  capability: ProgressCapability | null;
  visible: boolean;
  onClose: () => void;
  onAskTrefix: (capability: ProgressCapability) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * Capability details rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function CapabilityDetailSheet({
  capability,
  visible,
  onClose,
  onAskTrefix,
  theme,
  themeMode,
  copy,
}: Props) {
  if (!capability) {
    return (
      <BottomSheet visible={false} onClose={onClose} theme={theme} themeMode={themeMode} />
    );
  }

  const isDark = themeMode === "dark";
  const typeKey = capability.type;
  const translatedName =
    copy.progress?.capabilities?.types?.[typeKey] ||
    capability.name ||
    capability.type;

  return (
    <BottomSheet
      title={copy.progress?.capabilities?.detailTitle || "CAPABILITY DETAILS"}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Capability Header */}
        <View style={styles.headerRow}>
          <View>
            <SheetSectionLabel
              text={copy.progress?.capabilities?.detailTitle || "CAPABILITY DETAILS"}
              theme={theme}
            />
            <Text
              style={[
                styles.capTitle,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {translatedName}
            </Text>
          </View>

          <View
            style={[
              styles.valueBadge,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(9, 9, 11, 0.06)",
              },
            ]}
          >
            <Text
              style={[
                styles.valueText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {capability.value}
            </Text>
          </View>
        </View>

        {/* Description */}
        {capability.description ? (
          <Text
            style={[
              styles.description,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {capability.description}
          </Text>
        ) : null}

        {/* Metrics Breakdown */}
        {(capability.currentMetric || capability.previousMetric) && (
          <View
            style={[
              styles.metricBox,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
                borderColor: theme.color.border,
              },
            ]}
          >
            {capability.currentMetric ? (
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
                  Current:
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
                  {capability.currentMetric}
                </Text>
              </View>
            ) : null}

            {capability.previousMetric ? (
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
                  Previous:
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {capability.previousMetric}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Training Factors */}
        {capability.trainingFactors && capability.trainingFactors.length > 0 ? (
          <View style={styles.factorsBlock}>
            <SheetSectionLabel
              text={
                copy.progress?.capabilities?.relatedFactors || "Key contributing factors"
              }
              theme={theme}
            />
            {capability.trainingFactors.map((factor, idx) => (
              <View key={idx} style={styles.factorRow}>
                <CheckCircle2
                  size={16}
                  color={theme.color.foreground}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.factorText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {factor}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Ask Trefix Action Button */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onAskTrefix(capability);
          }}
          style={({ pressed }) => [
            styles.askButton,
            {
              backgroundColor: theme.color.foreground,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Sparkles size={18} color={theme.color.primaryForeground} strokeWidth={2} />
          <Text
            style={[
              styles.askButtonText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {copy.progress?.askTrefix || "Ask Trefix"}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  content: {
    gap: 16,
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  capTitle: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  valueBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  valueText: {
    fontSize: 28,
    lineHeight: 32,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  metricBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  metricValue: {
    fontSize: 15,
    lineHeight: 18,
  },
  factorsBlock: {
    gap: 10,
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  factorText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
  },
  askButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
});
