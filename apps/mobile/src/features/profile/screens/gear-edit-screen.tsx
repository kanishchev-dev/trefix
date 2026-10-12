import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { type GearInput, type WorkoutType } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Ruler } from "@workspace/ui-native";

import { trackEvent } from "../../../lib/analytics";
import {
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { InlineError } from "../../plans/components/plans-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { useGear, useGearMutation } from "../hooks/use-gear";
import { usePreferences } from "../hooks/use-preferences";
import { createFormatter, profileErrorMessage } from "../lib/profile-format";

type Props = {
  gearId?: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

const WORKOUT_TYPES = [
  "easy",
  "recovery",
  "long_run",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "race",
] as const;
const PRESETS = [
  { key: "race", km: 400 },
  { key: "training", km: 700 },
  { key: "trail", km: 800 },
] as const;

type Draft = Required<Omit<GearInput, "nickname" | "startedAt">> & {
  nickname: string;
  startedAt: string | null;
};

const EMPTY: Draft = {
  brand: "",
  model: "",
  nickname: "",
  initialDistanceKm: 0,
  limitKm: 700,
  startedAt: null,
  defaultWorkoutTypes: [],
  replaceReminder: true,
};

/** D5 — add or edit a pair of shoes. */
export function GearEditScreen({
  gearId,
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { data: active = [] } = useGear("active");
  const { data: retired = [] } = useGear("retired");
  const mutation = useGearMutation();
  const { preferences } = usePreferences();
  const existing = useMemo(
    () => [...active, ...retired].find((gear) => gear.id === gearId) ?? null,
    [active, retired, gearId],
  );
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const e = copy.profile.gearEdit;
  const format = createFormatter(copy, language, preferences);
  const units = preferences.units;
  const distanceUnit =
    units === "imperial" ? format.labels.mi : format.labels.km;

  useEffect(() => {
    if (!existing) return;
    setDraft({
      brand: existing.brand,
      model: existing.model,
      nickname: existing.nickname ?? "",
      initialDistanceKm: existing.initialDistanceKm,
      limitKm: existing.limitKm,
      startedAt: existing.startedAt,
      defaultWorkoutTypes: existing.defaultWorkoutTypes,
      replaceReminder: existing.replaceReminder,
    });
  }, [existing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const valid = draft.brand.trim().length > 0 && draft.model.trim().length > 0;
  const takenElsewhere = new Set(
    active
      .filter((gear) => gear.id !== gearId)
      .flatMap((gear) => gear.defaultWorkoutTypes),
  );
  const movesTypes = draft.defaultWorkoutTypes.some((type) =>
    takenElsewhere.has(type),
  );

  const submit = async () => {
    setError(null);
    const input: GearInput = {
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      nickname: draft.nickname.trim() || null,
      initialDistanceKm: draft.initialDistanceKm,
      limitKm: draft.limitKm,
      startedAt: draft.startedAt,
      defaultWorkoutTypes: draft.defaultWorkoutTypes,
      replaceReminder: draft.replaceReminder,
    };
    try {
      if (existing) {
        await mutation.mutateAsync({
          kind: "update",
          gearId: existing.id,
          input,
        });
      } else {
        await mutation.mutateAsync({ kind: "create", input });
        trackEvent("gear_created", { source: "manual" });
      }
      onBack();
    } catch (saveError) {
      setError(profileErrorMessage(saveError, copy));
    }
  };

  const input = (
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    maxLength: number,
  ) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.color.mutedForeground}
      maxLength={maxLength}
      style={[
        styles.input,
        {
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    />
  );

  const toggleType = (type: WorkoutType) =>
    set(
      "defaultWorkoutTypes",
      draft.defaultWorkoutTypes.includes(type)
        ? draft.defaultWorkoutTypes.filter((entry) => entry !== type)
        : [...draft.defaultWorkoutTypes, type],
    );

  return (
    <ProfileSubScreen
      title={existing ? e.editTitle : e.newTitle}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={e.model} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={e.brand}
            trailing={input(
              draft.brand,
              (text) => set("brand", text),
              "Nike",
              60,
            )}
          />
          <ListRow
            theme={theme}
            title={e.modelName}
            trailing={input(
              draft.model,
              (text) => set("model", text),
              "Pegasus 41",
              80,
            )}
          />
          <ListRow
            theme={theme}
            title={e.nickname}
            trailing={input(
              draft.nickname,
              (text) => set("nickname", text),
              e.optional,
              60,
            )}
          />
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={e.resource} theme={theme} />
        <View style={[styles.rulerCard, { backgroundColor: theme.color.card }]}>
          <Ruler
            value={Math.round(kmToDisplay(draft.limitKm, units) / 10) * 10}
            onChange={(value) =>
              set(
                "limitKm",
                Math.min(
                  2000,
                  Math.max(100, Math.round(displayToKm(value, units))),
                ),
              )
            }
            min={units === "imperial" ? 60 : 100}
            max={units === "imperial" ? 1240 : 2000}
            step={10}
            majorEvery={100}
            labelEvery={200}
            unit={distanceUnit}
            accessibilityLabel={e.resource}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
        <ChipScroller>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.key}
              theme={theme}
              label={`${e.presets[preset.key]} · ${format.distance(preset.km, 0)}`}
              selected={draft.limitKm === preset.km}
              onPress={() => set("limitKm", preset.km)}
            />
          ))}
        </ChipScroller>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={e.mileage} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={e.initial}
            value={format.distance(draft.initialDistanceKm, 0)}
            onPress={() =>
              setSheet({
                kind: "number",
                title: e.initial,
                value: Math.round(kmToDisplay(draft.initialDistanceKm, units)),
                fallback: 0,
                min: 0,
                max: units === "imperial" ? 1500 : 2500,
                step: 5,
                majorEvery: 50,
                labelEvery: 100,
                unit: distanceUnit,
                onSave: async (value) =>
                  set(
                    "initialDistanceKm",
                    Math.round(displayToKm(value ?? 0, units) * 10) / 10,
                  ),
              })
            }
          />
          <ListRow
            theme={theme}
            title={e.start}
            value={
              draft.startedAt
                ? formatShortDate(draft.startedAt, language)
                : e.notSet
            }
            onPress={() =>
              setSheet({
                kind: "date",
                title: e.start,
                value: draft.startedAt,
                fallback: new Date().toISOString().slice(0, 10),
                minDate: "2000-01-01",
                clearable: true,
                onSave: async (value) => set("startedAt", value),
              })
            }
          />
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={e.defaults} theme={theme} />
        <ChipScroller>
          {WORKOUT_TYPES.map((type) => (
            <Chip
              key={type}
              theme={theme}
              label={copy.profile.workoutTypes[type]}
              selected={draft.defaultWorkoutTypes.includes(type)}
              onPress={() => toggleType(type)}
            />
          ))}
        </ChipScroller>
        {movesTypes ? <Footnote text={e.defaultsMoved} theme={theme} /> : null}
      </ProfileSection>

      <ListCard theme={theme}>
        <ListRow
          theme={theme}
          title={e.reminder}
          description={e.reminderDescription}
          trailing={
            <Switch
              theme={theme}
              value={draft.replaceReminder}
              onValueChange={(value) => set("replaceReminder", value)}
              accessibilityLabel={e.reminder}
            />
          }
        />
      </ListCard>

      {error ? <InlineError message={error} theme={theme} /> : null}
      <SheetButton
        label={existing ? e.save : e.add}
        disabled={!valid}
        pending={mutation.isPending}
        onPress={() => void submit()}
        theme={theme}
        themeMode={themeMode}
      />

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
  input: {
    minWidth: 120,
    maxWidth: 200,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 4,
  },
  rulerCard: {
    borderRadius: 24,
    paddingVertical: 12,
    overflow: "hidden",
  },
});
