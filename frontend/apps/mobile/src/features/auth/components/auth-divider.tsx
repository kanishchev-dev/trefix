import { StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { type AuthCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  copy: AuthCopy;
};

export function AuthDivider({ theme, copy }: Props) {
  return (
    <View style={styles.dividerRow}>
      <View
        style={[styles.dividerLine, { backgroundColor: theme.color.border }]}
      />
      <Text
        style={[
          styles.dividerText,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {copy.divider}
      </Text>
      <View
        style={[styles.dividerLine, { backgroundColor: theme.color.border }]}
      />
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
    alignSelf: "center",
    width: "60%",
    maxWidth: 200,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.6,
  },
  dividerText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
