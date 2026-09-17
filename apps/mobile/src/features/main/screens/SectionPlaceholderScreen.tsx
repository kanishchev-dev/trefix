import { StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  title: string;
};

export function SectionPlaceholderScreen({ theme, title }: Props) {
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
          {title}
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
