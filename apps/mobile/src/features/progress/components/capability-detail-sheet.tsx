import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Sparkles, X, CheckCircle2 } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressCapability } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  capability: ProgressCapability | null;
  visible: boolean;
  onClose: () => void;
  onAskTrefix: (capability: ProgressCapability) => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

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
    return null;
  }

  const isDark = themeMode === "dark";
  const typeKey = capability.type;
  const translatedName =
    copy.progress?.capabilities?.types?.[typeKey] ||
    capability.name ||
    capability.type;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          {/* Sheet Handle & Close */}
          <View style={styles.topBar}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={theme.color.foreground} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Capability Header */}
            <View style={styles.headerRow}>
              <View>
                <Text
                  style={[
                    styles.capCategory,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {copy.progress?.capabilities?.detailTitle || "CAPABILITY DETAILS"}
                </Text>
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
                <Text
                  style={[
                    styles.factorsTitle,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {copy.progress?.capabilities?.relatedFactors || "Key contributing factors"}
                </Text>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "85%",
    paddingBottom: 32,
  },
  topBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 10,
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  capCategory: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
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
    marginBottom: 20,
  },
  metricBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginBottom: 20,
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
    marginBottom: 24,
    gap: 10,
  },
  factorsTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    borderRadius: 18,
    gap: 8,
    marginTop: 8,
  },
  askButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
});
