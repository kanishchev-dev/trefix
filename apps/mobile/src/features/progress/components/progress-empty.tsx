import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { fonts, progressPalette } from "./progress-ui";

type Props = {
  theme: ThemeTokens;
  copy: MainCopy;
  onRecord: () => void;
  onImport: () => void;
};

/** No workouts yet: one placeholder, no header block and no tabs. */
export function ProgressEmpty({ theme, copy, onRecord, onImport }: Props) {
  const t = copy.progressOverview.empty;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const bars = [
    { height: 12, color: palette.faint },
    { height: 20, color: palette.muted },
    { height: 30, color: palette.fg },
  ];

  return (
    <View style={styles.root}>
      <View
        style={[styles.icon, { backgroundColor: palette.card }]}
        accessibilityElementsHidden
      >
        {bars.map((bar) => (
          <View
            key={bar.height}
            style={[
              styles.bar,
              { height: bar.height, backgroundColor: bar.color },
            ]}
          />
        ))}
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: palette.fg, fontFamily: font.medium }]}
      >
        {t.title}
      </Text>
      <Text
        style={[
          styles.text,
          { color: palette.muted, fontFamily: font.regular },
        ]}
      >
        {t.text}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onRecord}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: palette.inverse },
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.buttonText,
              { color: palette.inverseFg, fontFamily: font.medium },
            ]}
          >
            {t.record}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onImport}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.line,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.buttonText,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {t.import}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 120,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 5,
    paddingBottom: 18,
    marginBottom: 8,
  },
  bar: { width: 8, borderRadius: 2, transform: [{ skewX: "-24deg" }] },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  text: { fontSize: 15, lineHeight: 21, maxWidth: 300, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 20 },
  button: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 15 },
  pressed: { opacity: 0.7 },
});
