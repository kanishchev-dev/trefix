import { StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

export function AuthDivider({ theme }: Props) {
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: theme.color.glassBorder }]} />
      <Text
        style={[
          styles.dividerText,
          { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium },
        ]}
      >
        или
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: theme.color.glassBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
