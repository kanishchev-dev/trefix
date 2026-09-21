import { Pressable, StyleSheet, Text, View } from "react-native";
import { AlertCircle, RefreshCw } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onRetry: () => void;
};

export function PlanErrorState({
  theme,
  copy,
  onRetry,
}: Props) {
  const errorCopy = copy.plan.errorState;

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
        <AlertCircle color={theme.color.mutedForeground} size={32} />
      </View>

      <View style={styles.textGroup}>
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {errorCopy.title}
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
          {errorCopy.description}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <RefreshCw color={theme.color.foreground} size={16} />
        <Text
          style={[
            styles.buttonText,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {errorCopy.retryButton}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  button: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 18,
  },
});
