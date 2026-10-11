import { useState } from "react";
import { View } from "react-native";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
  type TrainingWeekday,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { Notice, NoticeText } from "../../plans/components/plans-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { Stepper } from "../components/stepper";
import { WeekdayPicker } from "../components/weekday-picker";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../hooks/use-athlete-profile";
import { usePreferences } from "../hooks/use-preferences";
import {
  createFormatter,
  orderedWeekdays,
  profileErrorMessage,
  WEEKDAYS,
  weekdayFull,
  weekdayShort,
} from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** P4 — training days, preferred time, sessions per week, durations and usual weekly volume. */
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
  const format = createFormatter(copy, language, preferences);
  const distanceUnit =
    preferences.units === "imperial" ? format.labels.mi : format.labels.km;

  const save = async (patch: AthleteProfileUpdate) => {
    await update.mutateAsync(patch);
    trackEvent("profile_field_updated", {
      field: Object.keys(patch).join(","),
      source: "manual",
    });
  };
  const saveQuietly = (patch: AthleteProfileUpdate) =>
    void save(patch).catch((error) =>
      showToast(profileErrorMessage(error, copy)),
    );

  if (!athlete) {
    return (
      <ProfileSubScreen
        title={s.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </ProfileSubScreen>
    );
  }

  const days = athlete.availableTrainingDays;
  const toggleDay = (day: string) => {
    const next = days.includes(day)
      ? days.filter((entry) => entry !== day)
      : [...days, day];
    if (next.length === 0) return;
    const ordered = WEEKDAYS.filter((entry) => next.includes(entry));
    const patch: AthleteProfileUpdate = { availableTrainingDays: ordered };
    if (athlete.sessionsPerWeek > ordered.length)
      patch.sessionsPerWeek = ordered.length;
    if (
      athlete.longRunDay &&
      !ordered.includes(athlete.longRunDay as TrainingWeekday)
    )
      patch.longRunDay = null;
    saveQuietly(patch);
  };

  const openLongRunDay = (profile: AthleteProfile) =>
    setSheet({
      kind: "options",
      title: s.longRunDay,
      value: profile.longRunDay ?? null,
      options: WEEKDAYS.filter((day) =>
        profile.availableTrainingDays.includes(day),
      ).map((day) => ({
        value: day,
        label: weekdayFull(copy, day),
      })),
      onSave: (value) => save({ longRunDay: value as TrainingWeekday }),
    });

  const openMinutes = (
    field: "preferredWorkoutDurationMinutes" | "longRunMaxDurationMinutes",
    title: string,
    range: { min: number; max: number; step: number; fallback: number },
  ) =>
    setSheet({
      kind: "number",
      title,
      value: athlete[field] ?? null,
      fallback: range.fallback,
      min: range.min,
      max: range.max,
      step: range.step,
      majorEvery: range.step * 3,
      labelEvery: range.step * 6,
      formatValue: format.minutes,
      clearable: true,
      onSave: (value) => save({ [field]: value }),
    });

  const openVolume = () =>
    setSheet({
      kind: "number",
      title: s.volume,
      value: athlete.weeklyMileageKm
        ? Math.round(kmToDisplay(athlete.weeklyMileageKm, preferences.units))
        : null,
      fallback: preferences.units === "imperial" ? 15 : 25,
      min: 0,
      max: preferences.units === "imperial" ? 180 : 300,
      unit: distanceUnit,
      majorEvery: 10,
      labelEvery: 10,
      onSave: (value) =>
        save({
          weeklyMileageKm:
            value === null
              ? null
              : Math.round(displayToKm(value, preferences.units) * 10) / 10,
        }),
    });

  const suggestion = athlete.weeklyMileageSuggestion ?? null;
  const notSet = copy.profile.summary.notSet;

  return (
    <ProfileSubScreen
      title={s.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={s.days} theme={theme} />
        <WeekdayPicker
          days={orderedWeekdays(preferences.weekStart).map((day) => ({
            value: day,
            label: weekdayShort(copy, day),
          }))}
          selected={days}
          onToggle={toggleDay}
          theme={theme}
        />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={s.time} theme={theme} />
        <Segmented
          segments={(["morning", "day", "evening", "any"] as const).map(
            (value) => ({ value, label: s.times[value] }),
          )}
          value={athlete.preferredTimeOfDay ?? "any"}
          onChange={(value) => saveQuietly({ preferredTimeOfDay: value })}
          theme={theme}
          themeMode={themeMode}
        />
      </ProfileSection>

      <ListCard theme={theme}>
        <ListRow
          theme={theme}
          title={s.perWeek}
          trailing={
            <Stepper
              value={athlete.sessionsPerWeek}
              min={1}
              max={Math.max(1, Math.min(7, days.length))}
              onChange={(value) => saveQuietly({ sessionsPerWeek: value })}
              theme={theme}
              accessibilityLabel={s.perWeek}
            />
          }
        />
        <ListRow
          theme={theme}
          title={s.longRunDay}
          value={
            athlete.longRunDay ? weekdayFull(copy, athlete.longRunDay) : notSet
          }
          onPress={() => openLongRunDay(athlete)}
        />
        <ListRow
          theme={theme}
          title={s.usual}
          value={
            athlete.preferredWorkoutDurationMinutes
              ? fillTemplate(s.upTo, {
                  value: format.minutes(
                    athlete.preferredWorkoutDurationMinutes,
                  ),
                })
              : notSet
          }
          onPress={() =>
            openMinutes("preferredWorkoutDurationMinutes", s.usual, {
              min: 15,
              max: 240,
              step: 5,
              fallback: 45,
            })
          }
        />
        <ListRow
          theme={theme}
          title={s.longRun}
          value={
            athlete.longRunMaxDurationMinutes
              ? fillTemplate(s.upTo, {
                  value: format.minutes(athlete.longRunMaxDurationMinutes),
                })
              : notSet
          }
          onPress={() =>
            openMinutes("longRunMaxDurationMinutes", s.longRun, {
              min: 30,
              max: 360,
              step: 15,
              fallback: 90,
            })
          }
        />
      </ListCard>

      <ProfileSection>
        <SectionTitle text={s.volume} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={s.volume}
            value={
              athlete.weeklyMileageKm
                ? fillTemplate(s.volumeValue, {
                    value: format.distance(athlete.weeklyMileageKm, 0),
                  })
                : notSet
            }
            onPress={openVolume}
          />
        </ListCard>
        {suggestion ? (
          <Notice
            theme={theme}
            action={{
              label: s.suggestionApply,
              onPress: () =>
                saveQuietly({ weeklyMileageKm: suggestion.valueKm }),
            }}
          >
            <NoticeText theme={theme}>
              {fillTemplate(s.suggestion, {
                value: format.distance(suggestion.valueKm, 0),
              })}
            </NoticeText>
          </Notice>
        ) : null}
        <Footnote text={s.footnote} theme={theme} />
      </ProfileSection>

      <View />
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
