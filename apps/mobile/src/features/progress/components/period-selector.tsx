import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressPeriod } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  selectedPeriod: ProgressPeriod;
  onSelectPeriod: (period: ProgressPeriod) => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

const PERIODS: ProgressPeriod[] = ["4W", "8W", "3M", "6M", "1Y"];

export function PeriodSelector({
  selectedPeriod,
  onSelectPeriod,
  theme,
  themeMode,
  copy,
}: Props) {
  const isDark = themeMode === "dark";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.04)",
          borderColor: theme.color.border,
        },
      ]}
    >
      {PERIODS.map((periodKey) => {
        const isSelected = selectedPeriod === periodKey;
        const label = copy.progress?.periods?.[periodKey] || periodKey;

        return (
          <Pressable
            key={periodKey}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              if (!isSelected) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectPeriod(periodKey);
              }
            }}
            style={[
              styles.button,
              isSelected && [
                styles.selectedButton,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.text,
                {
                  color: isSelected
                    ? theme.color.foreground
                    : theme.color.mutedForeground,
                  fontFamily: isSelected
                    ? theme.typography.fontFamily.sans.bold
                    : theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 3,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  selectedButton: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 13,
    lineHeight: 16,
  },
});
