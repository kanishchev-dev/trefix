import { StyleSheet, Text, View } from "react-native";
import { Compass } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function ProgressEmptyState({ theme, themeMode, copy }: Props) {
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
        <Compass size={32} color={theme.color.foreground} strokeWidth={1.8} />
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
        {copy.progress?.emptyState?.title || "Your progress is just beginning"}
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
        {copy.progress?.emptyState?.description ||
          "Complete a few more runs and Trefix will start building your runner profile."}
      </Text>
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
    textAlign: "center",
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
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
