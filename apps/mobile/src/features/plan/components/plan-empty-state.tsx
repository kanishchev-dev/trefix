import { Pressable, StyleSheet, Text, View } from "react-native";
import { Target } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onCreatePlan: () => void;
};

export function PlanEmptyState({
  theme,
  copy,
  onCreatePlan,
}: Props) {
  const emptyCopy = copy.plan.emptyState;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <Target color={theme.color.accent} size={32} />
      </View>

      <View style={styles.textGroup}>
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {emptyCopy.title}
        </Text>
        <Text
          style={[
            styles.description,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {emptyCopy.description}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onCreatePlan}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.color.primary },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {emptyCopy.createButton}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 280,
  },
  button: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
  },
});
