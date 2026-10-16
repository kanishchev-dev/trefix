import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";

import {
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { healthStoreName } from "../../health-sync/health-integration-screen";
import { ProfileSheet } from "../../profile/components/profile-sheet";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import {
  usePreferences,
  useUpdatePreferences,
} from "../../profile/hooks/use-preferences";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
  onOpenCoach: () => void;
};

type Flag = Exclude<
  keyof UserPreferences["notifications"],
  "workoutReminderTime"
>;
type ReminderTime = UserPreferences["notifications"]["workoutReminderTime"];

const REMINDER_TIMES: ReminderTime[] = ["morning", "2h", "1h", "30m"];

/** Whether the system lets the app show notifications; re-checked when the app comes back. */
function useNotificationsAllowed(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const check = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((status: Notifications.NotificationPermissionsStatus) =>
        setAllowed(status.granted || status.status === "undetermined"),
      )
      .catch(() => setAllowed(null));
  }, []);
  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [check]);
  return allowed;
}

/** Workout and progress notifications; coach messages are set up on the coach screen. */
export function NotificationsSettingsScreen({
  theme,
  themeMode,
  copy,
  onBack,
  onOpenCoach,
}: Props) {
  const { preferences } = usePreferences();
  const update = useUpdatePreferences();
  const allowed = useNotificationsAllowed();
  const [reminderVisible, setReminderVisible] = useState(false);
  const n = copy.profile.notificationsScreen;
  const settings = preferences.notifications;
  const disabled = allowed === false;

  const patch = (notifications: UserPreferencesUpdate["notifications"]) =>
    update.mutate({ notifications });

  const flagRow = (flag: Flag) => {
    const item = n.items[flag];
    return (
      <ListRow
        key={flag}
        theme={theme}
        title={item.title}
        description={fillTemplate(item.description, {
          health: healthStoreName(copy),
        })}
        trailing={
          <Switch
            theme={theme}
            value={settings[flag]}
            disabled={disabled}
            accessibilityLabel={item.title}
            onValueChange={(value) => patch({ [flag]: value })}
          />
        }
      />
    );
  };

  return (
    <ProfileSubScreen
      title={n.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      {disabled ? (
        <View style={[styles.alert, { backgroundColor: theme.color.card }]}>
          <Text
            style={[
              styles.alertTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {n.deniedTitle}
          </Text>
          <Text
            style={[
              styles.alertBody,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {n.deniedBody}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [
              styles.alertButton,
              { backgroundColor: theme.color.iconSurface },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.alertButtonText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {n.openSettings}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ProfileSection>
        <SectionTitle text={n.workouts} theme={theme} />
        <View
          style={disabled ? styles.dimmed : undefined}
          pointerEvents={disabled ? "none" : "auto"}
        >
          <ListCard theme={theme} bare>
            {flagRow("workoutReminder")}
            {settings.workoutReminder && !disabled ? (
              <ListRow
                theme={theme}
                title={n.reminderTime}
                value={n.reminderValues[settings.workoutReminderTime]}
                chevron={false}
                onPress={() => setReminderVisible(true)}
              />
            ) : null}
            {flagRow("missedWorkout")}
            {flagRow("planChanged")}
          </ListCard>
        </View>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={n.progress} theme={theme} />
        <View
          style={disabled ? styles.dimmed : undefined}
          pointerEvents={disabled ? "none" : "auto"}
        >
          <ListCard theme={theme} bare>
            {flagRow("achievements")}
            {flagRow("workoutSynced")}
          </ListCard>
        </View>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={n.coach} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={n.coachMessages}
            description={n.coachMessagesDescription}
            onPress={onOpenCoach}
          />
        </ListCard>
        <Footnote text={n.coachHint} theme={theme} />
      </ProfileSection>

      <ProfileSheet
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        title={n.reminderTime}
        actions={REMINDER_TIMES.map((time) => ({
          key: time,
          label: n.reminderOptions[time],
          description: time === "morning" ? n.morningDescription : undefined,
          selected: time === settings.workoutReminderTime,
          onPress: () => patch({ workoutReminderTime: time }),
        }))}
        body={n.reminderHint}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
    alignItems: "flex-start",
  },
  alertTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  alertBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertButton: {
    marginTop: 4,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  alertButtonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
});
