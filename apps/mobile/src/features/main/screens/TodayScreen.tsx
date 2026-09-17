import { ScrollView, StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

const LOREM_IPSUM = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin nisl. Integer in mauris eu nibh euismod gravida.

Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat.

Cras mollis scelerisque nunc. Donec odeo. Nam te, metus a faucibus pretium, ante nulla egestas erat, vitae sodales ipsum lectus sit amet enim.
`.repeat(5);

export function TodayScreen({ theme }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.extrabold }]}>
        Сегодня
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
    paddingBottom: 120, // Enough to scroll past the tab bar
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
