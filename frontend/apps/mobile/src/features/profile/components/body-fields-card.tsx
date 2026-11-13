import { useState } from "react";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { syncStravaProfile } from "../../../lib/integrations-api";
import { trackEvent } from "../../../lib/analytics";
import {
  formatLongDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKg, kgToDisplay } from "../../../shared/lib/units";
import { ListCard, ListRow, SourceBadge } from "../../../shared/ui/list-card";
import { useStravaIntegration } from "../../main/hooks/use-integrations";
import { useUpdateAthleteProfile } from "../hooks/use-athlete-profile";
import { usePreferences } from "../hooks/use-preferences";
import { createFormatter } from "../lib/profile-format";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "./profile-value-sheet";

type Props = {
  athlete: AthleteProfile;
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

type SourcedField = "birthDate" | "sex" | "heightCm" | "weightKg";

const CM_PER_INCH = 2.54;

/** Date of birth, sex, height and weight with their sources; used by the body screen and the wizard. */
export function BodyFieldsCard({
  athlete,
  copy,
  language,
  theme,
  themeMode,
}: Props) {
  const update = useUpdateAthleteProfile();
  const { preferences } = usePreferences();
  const { data: strava } = useStravaIntegration();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);

  const b = copy.profile.body;
  const format = createFormatter(copy, language, preferences);
  const stravaConnected = Boolean(strava && strava.status !== "disconnected");
  const profileAccess = Boolean(strava?.profileAccess);
  const imperialHeight = format.heightUnits === "imperial";
  const imperialWeight = format.weightUnits === "imperial";

  const save = async (patch: AthleteProfileUpdate) => {
    await update.mutateAsync(patch);
    trackEvent("profile_field_updated", {
      field: Object.keys(patch).join(","),
      source: "manual",
    });
  };

  const sourceOf = (field: SourcedField) =>
    athlete?.fieldSources?.[field] ?? null;
  const badge = (field: SourcedField) => {
    const source = sourceOf(field)?.source;
    if (source === "strava") return <SourceBadge theme={theme} />;
    if (source === "apple_health" || source === "health_connect")
      return <SourceBadge theme={theme} label="H" />;
    return undefined;
  };
  const provenance = (field: SourcedField): ValueSheetConfig["provenance"] => {
    const source = sourceOf(field);
    const fromHealth =
      source?.source === "apple_health" || source?.source === "health_connect";
    if (!stravaConnected && !fromHealth) return undefined;
    return {
      source: source?.source ?? null,
      updatedAt: source?.updatedAt,
      canReset:
        profileAccess &&
        source?.source === "manual" &&
        (field === "weightKg" || field === "sex"),
      onReset: async () => {
        await save({ resetSources: [field] });
        await syncStravaProfile();
      },
    };
  };

  const openBirthDate = (profile: AthleteProfile) =>
    setSheet({
      kind: "date",
      title: b.birthDate,
      value: profile.birthDate ?? null,
      fallback: "1990-01-01",
      minDate: "1926-01-01",
      provenance: provenance("birthDate"),
      onSave: (value) => save({ birthDate: value }),
    });

  const openSex = (profile: AthleteProfile) =>
    setSheet({
      kind: "options",
      title: b.sex,
      value: profile.sex,
      options: (["male", "female"] as const).map((value) => ({
        value,
        label: b.sexes[value],
      })),
      hint: copy.profile.bodyScreen.sexHint,
      provenance: provenance("sex"),
      onSave: (value) => save({ sex: value as AthleteProfileUpdate["sex"] }),
    });

  const openHeight = (profile: AthleteProfile) =>
    setSheet(
      imperialHeight
        ? {
            kind: "number",
            title: b.height,
            value: profile.heightCm
              ? Math.round(profile.heightCm / CM_PER_INCH)
              : null,
            fallback: 69,
            min: 48,
            max: 90,
            majorEvery: 12,
            labelEvery: 12,
            formatValue: (inches) => format.height(inches * CM_PER_INCH),
            provenance: provenance("heightCm"),
            onSave: (inches) =>
              save({
                heightCm:
                  inches === null ? null : Math.round(inches * CM_PER_INCH),
              }),
          }
        : {
            kind: "number",
            title: b.height,
            value: profile.heightCm ?? null,
            fallback: 175,
            min: 120,
            max: 230,
            unit: format.labels.cm,
            majorEvery: 10,
            labelEvery: 10,
            provenance: provenance("heightCm"),
            onSave: (cm) => save({ heightCm: cm }),
          },
    );

  const openWeight = (profile: AthleteProfile) =>
    setSheet({
      kind: "number",
      title: b.weight,
      value: profile.weightKg
        ? Math.round(kgToDisplay(profile.weightKg, format.weightUnits) * 10) /
          10
        : null,
      fallback: imperialWeight ? 160 : 70,
      min: imperialWeight ? 66 : 30,
      max: imperialWeight ? 550 : 250,
      step: 0.1,
      unit: imperialWeight ? format.labels.lb : format.labels.kg,
      provenance: provenance("weightKg"),
      onSave: (value) =>
        save({
          weightKg:
            value === null
              ? null
              : Math.round(displayToKg(value, format.weightUnits) * 10) / 10,
        }),
    });

  const notSet = copy.profile.summary.notSet;

  return (
    <>
      <ListCard theme={theme} bare>
        <ListRow
          theme={theme}
          title={b.birthDate}
          value={
            athlete.birthDate
              ? formatLongDate(athlete.birthDate, language)
              : notSet
          }
          trailing={badge("birthDate")}
          onPress={() => openBirthDate(athlete)}
        />
        <ListRow
          theme={theme}
          title={b.sex}
          value={
            athlete.sex ? b.sexes[athlete.sex as keyof typeof b.sexes] : notSet
          }
          trailing={badge("sex")}
          onPress={() => openSex(athlete)}
        />
        <ListRow
          theme={theme}
          title={b.height}
          value={athlete.heightCm ? format.height(athlete.heightCm) : notSet}
          trailing={badge("heightCm")}
          onPress={() => openHeight(athlete)}
        />
        <ListRow
          theme={theme}
          title={b.weight}
          value={athlete.weightKg ? format.weight(athlete.weightKg) : notSet}
          trailing={badge("weightKg")}
          onPress={() => openWeight(athlete)}
        />
      </ListCard>
      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </>
  );
}
