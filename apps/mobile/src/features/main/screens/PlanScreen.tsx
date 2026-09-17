import { ScrollView, StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

const LOREM_IPSUM = `
PLANNING CONTENT:
1. Breakfast with Lorem
2. Meeting with Ipsum
3. Lunch with Dolor
4. Coding with Sit Amet
5. Review with Consectetur

Repeat until success:
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
`.repeat(10);

export function PlanScreen({ theme }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.extrabold }]}>
        План
      </Text>
      <Text style={[styles.text, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
        {LOREM_IPSUM}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  title: {
    fontSize: 36,
    marginBottom: 24,
  },
  text: {
    fontSize: 18,
    lineHeight: 28,
  },
});
