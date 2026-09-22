import { StyleSheet, Text, View } from "react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressCapability } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { CapabilityCard } from "./capability-card";

type Props = {
  capabilities: ProgressCapability[];
  onSelectCapability: (capability: ProgressCapability) => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function CapabilitiesSection({
  capabilities,
  onSelectCapability,
  theme,
  themeMode,
  copy,
}: Props) {
  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.bold,
          },
        ]}
      >
        {copy.progress?.capabilities?.sectionTitle || "RUNNER CAPABILITIES"}
      </Text>

      <View style={styles.grid}>
        {capabilities.map((cap) => (
          <View key={cap.type} style={styles.gridCol}>
            <CapabilityCard
              capability={cap}
              copy={copy}
              onPress={() => onSelectCapability(cap)}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    rowGap: 12,
  },
  gridCol: {
    width: "50%",
    paddingHorizontal: 6,
  },
});
