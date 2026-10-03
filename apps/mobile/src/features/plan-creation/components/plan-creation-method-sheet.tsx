import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { BottomSheet, SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
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
      borderWidth: 0,
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <SheetBlock theme={theme}>
          <View style={styles.cardsGroup}>
            {/* AI option */}
            <Pressable
              accessibilityRole="button"
              onPress={onOpenTrefix}
              style={methodCardStyle}
            >
              <View
                style={[
                  styles.methodIcon,
                  {
                    backgroundColor:
                      themeMode === "dark" ? "rgba(255, 255, 255, 0.06)" : theme.color.surfaceElevated,
                  },
                ]}
              >
                <Sparkles color={theme.color.accent} size={20} />
              </View>
              <View style={styles.methodTextGroup}>
                <Text
                  style={[
                    styles.methodTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
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
              <View
                style={[
                  styles.methodIcon,
                  {
                    backgroundColor:
                      themeMode === "dark" ? "rgba(255, 255, 255, 0.06)" : theme.color.surfaceElevated,
                  },
                ]}
              >
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
                      fontFamily: theme.typography.fontFamily.sans.medium,
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
          </View>
        </SheetBlock>

        {/* Cancel button */}
        <SheetBlock theme={theme}>
          <SheetButton
            label={common.cancel}
            onPress={onClose}
            variant="secondary"
            theme={theme}
            themeMode={themeMode}
          />
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  cardsGroup: {
    gap: 8,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 9999,
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
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});
