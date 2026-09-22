import { Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { MainCopy } from "../../../locales";

type Props = {
  onRetry: () => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function ProgressErrorState({ onRetry, theme, themeMode, copy }: Props) {
  const isDark = themeMode === "dark";

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
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.05)",
          },
        ]}
      >
        <AlertTriangle size={32} color={theme.color.foreground} strokeWidth={1.8} />
      </View>

      <Text
        style={[
          styles.title,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.extrabold,
          },
        ]}
      >
        {copy.progress?.errorState?.title || "Couldn't load progress"}
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
        {copy.progress?.errorState?.description ||
          "Please check your network connection and try again."}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryBtn,
          {
            backgroundColor: theme.color.foreground,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <RefreshCw size={16} color={theme.color.primaryForeground} strokeWidth={2} />
        <Text
          style={[
            styles.retryText,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {copy.progress?.errorState?.retry || "Try again"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 28,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  iconWrap: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    lineHeight: 18,
  },
});
