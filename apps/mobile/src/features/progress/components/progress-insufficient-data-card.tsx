import { StyleSheet, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";

type Props = {
  title?: string;
  description?: string;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function ProgressInsufficientDataCard({
  title,
  description,
  theme,
  themeMode,
  copy,
}: Props) {
  const isDark = themeMode === "dark";

  return (
    <Card
      variant="glass"
      theme={theme}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <AlertCircle size={16} color={theme.color.mutedForeground} strokeWidth={2} />
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {title || copy.progress?.insufficientData?.title || "Not enough data yet"}
        </Text>
      </View>

      <Text
        style={[
          styles.description,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {description ||
          copy.progress?.insufficientData?.description ||
          "Complete a few more quality sessions to unlock this trend."}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    lineHeight: 18,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
