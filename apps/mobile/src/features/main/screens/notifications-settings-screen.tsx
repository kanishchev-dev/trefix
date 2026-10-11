import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { Switch } from "../../../shared/ui/switch";
import { HeaderBackButton, HeaderTitle } from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy } from "../../../locales";
import { logger } from "../../../lib/logger";

const NOTIFICATIONS_STORAGE_KEY = "@trefix/notifications_settings";

export type NotificationsSettings = {
  workoutReminders: boolean;
  weeklySummary: boolean;
  aiUpdates: boolean;
};

const DEFAULT_SETTINGS: NotificationsSettings = {
  workoutReminders: true,
  weeklySummary: true,
  aiUpdates: true,
};

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

export function NotificationsSettingsScreen({
  theme,
  themeMode,
  copy,
  onBack,
}: Props) {
  const [settings, setSettings] =
    useState<NotificationsSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (stored) {
          setSettings(JSON.parse(stored) as NotificationsSettings);
        }
      } catch (error) {
        logger.warn("Failed to load notifications settings:", error);
      }
    }
    void loadSettings();
  }, []);

  const toggleSetting = (key: keyof NotificationsSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void AsyncStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(next),
      );
      return next;
    });
  };

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
          {copy.profile.settings.notificationsTitle}
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
          <View style={styles.row}>
            <View style={styles.textWrap}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.settings.notificationsWorkout}
              </Text>
              <Text
                style={[
                  styles.description,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {copy.profile.settings.notificationsWorkoutDesc}
              </Text>
            </View>
            <Switch
              value={settings.workoutReminders}
              onValueChange={() => toggleSetting("workoutReminders")}
              theme={theme}
            />
          </View>

          <View
            style={[styles.separator, { backgroundColor: theme.color.border }]}
          />

          <View style={styles.row}>
            <View style={styles.textWrap}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.settings.notificationsWeekly}
              </Text>
              <Text
                style={[
                  styles.description,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {copy.profile.settings.notificationsWeeklyDesc}
              </Text>
            </View>
            <Switch
              value={settings.weeklySummary}
              onValueChange={() => toggleSetting("weeklySummary")}
              theme={theme}
            />
          </View>

          <View
            style={[styles.separator, { backgroundColor: theme.color.border }]}
          />

          <View style={styles.row}>
            <View style={styles.textWrap}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.settings.notificationsAi}
              </Text>
              <Text
                style={[
                  styles.description,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {copy.profile.settings.notificationsAiDesc}
              </Text>
            </View>
            <Switch
              value={settings.aiUpdates}
              onValueChange={() => toggleSetting("aiUpdates")}
              theme={theme}
            />
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
  },
});
