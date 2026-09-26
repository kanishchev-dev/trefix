import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressCapability } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";

type Props = {
  capability: ProgressCapability;
  onPress: () => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function CapabilityCard({ capability, onPress, theme, themeMode, copy }: Props) {
  const typeKey = capability.type;
  const translatedName =
    copy.progress?.capabilities?.types?.[typeKey] ||
    capability.name ||
    capability.type;

  const isUp = capability.trend === "UP";
  const isDown = capability.trend === "DOWN";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Card
        variant="glass"
        theme={theme}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <Text
            style={[
              styles.nameText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {translatedName.toUpperCase()}
          </Text>
          <ChevronRight size={16} color={theme.color.mutedForeground} strokeWidth={2} />
        </View>

        <View style={styles.bottomRow}>
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

          <View style={styles.trendWrap}>
            {isUp ? (
              <ArrowUpRight size={16} color={theme.color.foreground} strokeWidth={2.5} />
            ) : isDown ? (
              <ArrowDownRight size={16} color={theme.color.mutedForeground} strokeWidth={2.5} />
            ) : (
              <Minus size={16} color={theme.color.mutedForeground} strokeWidth={2.5} />
            )}
            <Text
              style={[
                styles.trendText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {isUp ? `+${capability.change}%` : isDown ? `-${capability.change}%` : "0%"}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  nameText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  valueText: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
  },
  trendWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trendText: {
    fontSize: 13,
    lineHeight: 16,
  },
});
