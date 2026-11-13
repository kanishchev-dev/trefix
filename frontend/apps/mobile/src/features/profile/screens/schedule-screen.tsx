import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
  type TrainingWeekday,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { CircleRow } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../hooks/use-athlete-profile";
import { usePreferences } from "../hooks/use-preferences";
import { useUnitFormat } from "../hooks/use-unit-format";
import {
  orderedWeekdays,
  profileErrorMessage,
  WEEKDAYS,
  weekdayFull,
  weekdayShort,
} from "../lib/profile-format";
import { canDoubleUp, maxSessionsPerWeek } from "../lib/schedule-rules";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

const USUAL_OPTIONS = ["30", "45", "60", "90", "none"] as const;
const LONG_OPTIONS = ["90", "120", "150", "180", "none"] as const;

/** Training days, workouts per week (with doubles for advanced athletes), time, durations and volume. */
export function ScheduleScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { data: athlete } = useAthleteProfile();
  const update = useUpdateAthleteProfile();
  const { preferences } = usePreferences();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const s = copy.profile.schedule;
  const t = copy.profile.scheduleScreen;
  const format = useUnitFormat(copy, language);

  const save = async (patch: AthleteProfileUpdate) => {
    await update.mutateAsync(patch);
    trackEvent("profile_field_updated", {
      field: Object.keys(patch).join(","),
      source: "manual",
    });
  };
  const saveQuietly = (patch: AthleteProfileUpdate, toast?: string) =>
    void save(patch)
      .then(() => {
        if (toast) showToast(toast);
      })
      .catch((error) => showToast(profileErrorMessage(error, copy)));

  if (!athlete) {
    return (
      <ProfileSubScreen
        title={t.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </ProfileSubScreen>
    );
  }

  const days = athlete.availableTrainingDays;
  const doubles =
    Boolean(athlete.allowDoubles) && canDoubleUp(athlete.experienceLevel);
  const maxSessions = maxSessionsPerWeek(days.length, doubles);

  const toggleDay = (day: string) => {
    const next = days.includes(day)
      ? days.filter((entry) => entry !== day)
      : [...days, day];
    if (next.length === 0) return;
    const ordered = WEEKDAYS.filter((entry) => next.includes(entry));
    const patch: AthleteProfileUpdate = { availableTrainingDays: ordered };
    const nextMax = maxSessionsPerWeek(ordered.length, doubles);
    let toast: string | undefined;
    if (athlete.sessionsPerWeek > nextMax) {
      patch.sessionsPerWeek = nextMax;
      toast = fillTemplate(t.lowered, { count: nextMax });
    }
    if (
      athlete.longRunDay &&
      !ordered.includes(athlete.longRunDay as TrainingWeekday)
    ) {
      patch.longRunDay = null;
    }
    saveQuietly(patch, toast);
  };

  const toggleDoubles = (value: boolean) => {
    const patch: AthleteProfileUpdate = { allowDoubles: value };
    const nextMax = maxSessionsPerWeek(days.length, value);
    let toast: string | undefined;
    if (athlete.sessionsPerWeek > nextMax) {
      patch.sessionsPerWeek = nextMax;
      toast = fillTemplate(t.lowered, { count: nextMax });
    }
    saveQuietly(patch, toast);
  };

  const openLongRunDay = (profile: AthleteProfile) =>
    setSheet({
      kind: "options",
      title: s.longRunDay,
      value: profile.longRunDay ?? null,
      hint: t.longRunDayHint,
      options: orderedWeekdays(preferences.weekStart).map((day) => ({
        value: day,
        label: weekdayFull(copy, day),
        disabled: !profile.availableTrainingDays.includes(day),
      })),
      onSave: (value) => save({ longRunDay: value as TrainingWeekday }),
    });

  const openDuration = (
    field: "preferredWorkoutDurationMinutes" | "longRunMaxDurationMinutes",
  ) => {
    const usual = field === "preferredWorkoutDurationMinutes";
    const options = usual ? USUAL_OPTIONS : LONG_OPTIONS;
    const labels = usual ? t.durations : t.longDurations;
    const current = athlete[field];
    setSheet({
      kind: "options",
      title: usual ? s.usual : s.longRun,
      description: usual ? t.durationHint : undefined,
      value:
        current === null || current === undefined ? "none" : String(current),
      options: options.map((value) => ({
        value,
        label: (labels as Record<string, string>)[value],
      })),
      onSave: (value) =>
        save({ [field]: value === "none" ? null : Number(value) }),
    });
  };

  const openVolume = () =>
    setSheet({
      kind: "number",
      title: s.volume,
      value: athlete.weeklyMileageKm
        ? Math.round(kmToDisplay(athlete.weeklyMileageKm, format.units))
        : null,
      fallback: format.units === "imperial" ? 15 : 25,
      min: 0,
      max: format.units === "imperial" ? 180 : 300,
      unit: format.units === "imperial" ? t.volumeUnitImperial : t.volumeUnit,
      suggestion: suggestion
        ? {
            text: fillTemplate(s.suggestion, {
              value: format.distance(suggestion.valueKm, 0),
            }),
            actionLabel: s.suggestionApply,
            value: Math.round(kmToDisplay(suggestion.valueKm, format.units)),
          }
        : undefined,
      onSave: (value) =>
        save({
          weeklyMileageKm:
            value === null
              ? null
              : Math.round(displayToKm(value, format.units) * 10) / 10,
        }),
    });

  const suggestion = athlete.weeklyMileageSuggestion ?? null;
  const notSet = copy.profile.summary.notSet;
  const durationValue = (minutes: number | null | undefined) =>
    minutes
      ? fillTemplate(s.upTo, { value: format.minutes(minutes) })
      : t.noLimit;

  const sessions = athlete.sessionsPerWeek;
  const perWeekHint =
    doubles && sessions > days.length
      ? fillTemplate(t.doublesHint, {
          sessions: pluralize(t.sessions, sessions, language),
          days: pluralize(t.days, days.length, language),
          doubles: pluralize(t.days, sessions - days.length, language),
        })
      : sessions < days.length
        ? fillTemplate(t.pick, {
            picked: pluralize(t.days, sessions, language),
            days: days.length,
          })
        : t.everyDay;

  return (
    <ProfileSubScreen
      title={t.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={s.days} theme={theme} />
        <CircleRow
          theme={theme}
          idleColor={theme.color.card}
          items={orderedWeekdays(preferences.weekStart).map((day) => ({
            key: day,
            label: weekdayShort(copy, day),
            state: days.includes(day) ? "on" : "idle",
          }))}
          onPress={toggleDay}
        />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={s.perWeek} theme={theme} />
        <CircleRow
          theme={theme}
          idleColor={theme.color.card}
          items={[1, 2, 3, 4, 5, 6, 7].map((count) => ({
            key: String(count),
            label: String(count),
            state:
              count === sessions ? "on" : count > maxSessions ? "off" : "idle",
          }))}
          onPress={(key) => saveQuietly({ sessionsPerWeek: Number(key) })}
        />
        {canDoubleUp(athlete.experienceLevel) ? (
          <ListCard theme={theme} bare>
            <ListRow
              theme={theme}
              title={t.doubles}
              description={t.doublesDescription}
              trailing={
                <Switch
                  theme={theme}
                  value={doubles}
                  accessibilityLabel={t.doubles}
                  onValueChange={toggleDoubles}
                />
              }
            />
          </ListCard>
        ) : null}
        <Footnote text={perWeekHint} theme={theme} />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={s.time} theme={theme} />
        <SheetTabs
          tabs={(["morning", "day", "evening", "any"] as const).map((key) => ({
            key,
            label: s.times[key],
          }))}
          value={athlete.preferredTimeOfDay ?? "any"}
          onChange={(value) => saveQuietly({ preferredTimeOfDay: value })}
          theme={theme}
          trackColor={theme.color.card}
          accessibilityLabel={s.time}
        />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={t.durationVolume} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={s.longRunDay}
            value={
              athlete.longRunDay
                ? weekdayShort(copy, athlete.longRunDay)
                : notSet
            }
            chevron={false}
            onPress={() => openLongRunDay(athlete)}
          />
          <ListRow
            theme={theme}
            title={s.usual}
            value={durationValue(athlete.preferredWorkoutDurationMinutes)}
            chevron={false}
            onPress={() => openDuration("preferredWorkoutDurationMinutes")}
          />
          <ListRow
            theme={theme}
            title={s.longRun}
            value={durationValue(athlete.longRunMaxDurationMinutes)}
            chevron={false}
            onPress={() => openDuration("longRunMaxDurationMinutes")}
          />
          <ListRow
            theme={theme}
            title={s.volume}
            description={
              suggestion
                ? fillTemplate(s.suggestion, {
                    value: format.distance(suggestion.valueKm, 0),
                  })
                : undefined
            }
            value={
              athlete.weeklyMileageKm
                ? `~${format.distance(athlete.weeklyMileageKm, 0)}`
                : notSet
            }
            trailing={
              suggestion ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    saveQuietly({ weeklyMileageKm: suggestion.valueKm })
                  }
                  style={[
                    styles.pill,
                    { backgroundColor: theme.color.iconSurface },
                  ]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {s.suggestionApply}
                  </Text>
                </Pressable>
              ) : undefined
            }
            chevron={false}
            onPress={openVolume}
          />
        </ListCard>
        <Footnote text={s.footnote} theme={theme} />
      </ProfileSection>

      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
