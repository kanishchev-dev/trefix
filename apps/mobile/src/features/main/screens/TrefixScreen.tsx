import { StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

export function TrefixScreen({ theme }: Props) {
  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          Трефикс
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
  },
});
