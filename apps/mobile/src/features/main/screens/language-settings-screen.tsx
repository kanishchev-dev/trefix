import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { HeaderBackButton, HeaderTitle } from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type AppLanguage, type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  selectedLanguage: AppLanguage;
  onSelectLanguage: (language: AppLanguage) => void;
  onBack: () => void;
};

const LANGUAGES: { id: AppLanguage; labelKey: "ru" | "en" }[] = [
  { id: "ru", labelKey: "ru" },
  { id: "en", labelKey: "en" },
];

export function LanguageSettingsScreen({
  theme,
  themeMode,
  copy,
  selectedLanguage,
  onSelectLanguage,
  onBack,
}: Props) {
  return (
    <SectionLayout
      leftAction={
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      }
      headerCenter={
        <HeaderTitle theme={theme}>
          {copy.profile.settings.languageTitle}
        </HeaderTitle>
      }
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          {LANGUAGES.map((langOption, index) => {
            const isSelected = selectedLanguage === langOption.id;
            const label = copy.profile.settings.languages[langOption.labelKey];

            return (
              <View key={langOption.id}>
                {index > 0 ? (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: theme.color.border },
                    ]}
                  />
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelectLanguage(langOption.id);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color: theme.color.foreground,
                        fontFamily: isSelected
                          ? theme.typography.fontFamily.sans.semibold
                          : theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {label}
                  </Text>

                  {isSelected ? (
                    <Check
                      color={theme.color.primary}
                      size={20}
                      strokeWidth={2.5}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
  },
});
