import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { BottomSheet } from "../../../shared/ui/bottom-sheet";
import { type MainCopy } from "../../../locales";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenTrefix: () => void;
  onCreateManually: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * Creation-method selector shown as the canonical bottom sheet
 * (shared BottomSheet shell: blur backdrop, spring slide-up, drag-to-close).
 */
export function PlanCreationMethodSheet({
  visible,
  onClose,
  onOpenTrefix,
  onCreateManually,
  theme,
  themeMode,
  copy,
}: Props) {
  const locale = copy.plan.creation.selector;
  const common = copy.plan.creation.common;

  const methodCardStyle = ({ pressed }: { pressed: boolean }) => [
    styles.methodCard,
    {
      backgroundColor:
        themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
      borderColor:
        themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
    },
    pressed && styles.pressed,
  ];

  return (
    <BottomSheet
      title={locale.title}
      visible={visible}
      animatedHide
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      <Text
        style={[
          styles.subtitle,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {locale.subtitle}
      </Text>

      {/* AI option */}
      <Pressable
        accessibilityRole="button"
        onPress={onOpenTrefix}
        style={methodCardStyle}
      >
        <View style={styles.methodIcon}>
          <Sparkles color={theme.color.accent} size={18} />
        </View>
        <View style={styles.methodTextGroup}>
          <Text
            style={[
              styles.methodTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {locale.aiTitle}
          </Text>
          <Text
            style={[
              styles.methodDescription,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {locale.aiDescription}
          </Text>
        </View>
      </Pressable>

      {/* Manual option */}
      <Pressable
        accessibilityRole="button"
        onPress={onCreateManually}
        style={methodCardStyle}
      >
        <View style={styles.methodIcon}>
          <Text style={[styles.methodPlusIcon, { color: theme.color.accent }]}>
            +
          </Text>
        </View>
        <View style={styles.methodTextGroup}>
          <Text
            style={[
              styles.methodTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {locale.manualTitle}
          </Text>
          <Text
            style={[
              styles.methodDescription,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {locale.manualDescription}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
      >
        <Text
          style={[
            styles.cancelText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {common.cancel}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  methodCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(127,127,127,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodPlusIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  methodTextGroup: {
    flex: 1,
    gap: 2,
  },
  methodTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  methodDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});
