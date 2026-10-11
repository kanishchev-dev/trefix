import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
  type HrZone,
  type HrZonesMethod,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { trackEvent } from "../../../lib/analytics";
import { fillTemplate, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { Notice, NoticeText } from "../../plans/components/plans-ui";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { useActivePlan } from "../../plans/hooks/use-active-plan";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../hooks/use-athlete-profile";
import { usePreferences } from "../hooks/use-preferences";
import { profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

type HeartField = "restingHeartRate" | "maxHeartRate" | "thresholdHeartRate";

const RANGES: Record<
  HeartField,
  { min: number; max: number; fallback: number }
> = {
  restingHeartRate: { min: 30, max: 100, fallback: 55 },
  maxHeartRate: { min: 120, max: 230, fallback: 185 },
  thresholdHeartRate: { min: 100, max: 220, fallback: 165 },
};

/** Default custom bounds when nothing is known yet: max-HR shares of an assumed 185. */
const FALLBACK_CUSTOM = [111, 130, 148, 167];

/** P3 — resting, max and threshold heart rate, and the zones the server derives from them. */
export function HeartScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: athlete } = useAthleteProfile();
  const update = useUpdateAthleteProfile();
  const { showToast } = useToast();
  const activePlan = useActivePlan();
  const { preferences } = usePreferences();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const h = copy.profile.heart;
  const bpm = copy.profile.unitLabels.bpm;

  const save = async (patch: AthleteProfileUpdate) => {
    await update.mutateAsync(patch);
    trackEvent("profile_field_updated", {
      field: Object.keys(patch).join(","),
      source: "manual",
    });
    // Zones drive heart-rate targets of the active plan; in "confirm" mode the coach proposes the update.
    if (
      activePlan.data?.plan &&
      preferences.coachEnabled &&
      preferences.coachAdaptationMode === "confirm"
    ) {
      showToast(h.planNote);
    }
  };

  const openValue = (
    field: HeartField,
    title: string,
    profile: AthleteProfile,
  ) => {
    const range = RANGES[field];
    const estimate =
      field === "maxHeartRate" ? profile.maxHeartRateEstimate : null;
    setSheet({
      kind: "number",
      title,
      value: profile[field] ?? null,
      fallback: estimate ?? range.fallback,
      min: range.min,
      max: range.max,
      unit: bpm,
      majorEvery: 10,
      labelEvery: 10,
      clearable: true,
      onSave: (value) => save({ [field]: value }),
    });
  };

  const openCustomBound = (index: number, profile: AthleteProfile) => {
    const bounds =
      profile.hrZonesCustom ??
      currentUpperBounds(profile.hrZones) ??
      FALLBACK_CUSTOM;
    setSheet({
      kind: "number",
      title: fillTemplate(h.zoneUpper, { zone: index + 1 }),
      value: bounds[index],
      fallback: bounds[index],
      min: 60,
      max: 225,
      unit: bpm,
      majorEvery: 10,
      labelEvery: 10,
      onSave: async (value) => {
        if (value === null) return;
        const next = [...bounds];
        next[index] = value;
        await save({ hrZonesMethod: "custom", hrZonesCustom: next });
      },
    });
  };

  const changeMethod = async (
    method: HrZonesMethod,
    profile: AthleteProfile,
  ) => {
    try {
      if (method === "custom") {
        const bounds =
          profile.hrZonesCustom ??
          currentUpperBounds(profile.hrZones) ??
          FALLBACK_CUSTOM;
        await save({ hrZonesMethod: "custom", hrZonesCustom: bounds });
      } else {
        await save({ hrZonesMethod: method });
      }
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  if (!athlete) {
    return (
      <ProfileSubScreen
        title={h.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </ProfileSubScreen>
    );
  }

  const method = athlete.hrZonesMethod ?? "max_hr";
  const zones = athlete.hrZones ?? null;
  const reason = athlete.hrZonesUnavailableReason ?? null;
  const valueOf = (field: HeartField) =>
    athlete[field] ? `${athlete[field]} ${bpm}` : h.notSet;
  const colorOf = (field: HeartField) =>
    athlete[field] ? undefined : theme.color.warning;

  const fixReason = () => {
    if (reason === "threshold_missing")
      openValue("thresholdHeartRate", h.threshold, athlete);
    else if (reason === "max_missing")
      openValue("maxHeartRate", h.max, athlete);
    else openCustomBound(0, athlete);
  };

  return (
    <ProfileSubScreen
      title={h.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={h.values} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={h.rest}
            value={valueOf("restingHeartRate")}
            valueColor={colorOf("restingHeartRate")}
            onPress={() => openValue("restingHeartRate", h.rest, athlete)}
          />
          <ListRow
            theme={theme}
            title={h.max}
            description={
              !athlete.maxHeartRate && athlete.maxHeartRateEstimate
                ? fillTemplate(h.estimate, {
                    value: athlete.maxHeartRateEstimate,
                  })
                : undefined
            }
            value={valueOf("maxHeartRate")}
            valueColor={colorOf("maxHeartRate")}
            onPress={() => openValue("maxHeartRate", h.max, athlete)}
          />
          <ListRow
            theme={theme}
            title={h.threshold}
            value={valueOf("thresholdHeartRate")}
            valueColor={colorOf("thresholdHeartRate")}
            onPress={() =>
              openValue("thresholdHeartRate", h.threshold, athlete)
            }
          />
        </ListCard>
        {!athlete.thresholdHeartRate ? (
          <Notice theme={theme}>
            <NoticeText theme={theme}>{h.thresholdHint}</NoticeText>
          </Notice>
        ) : null}
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={h.zones} theme={theme} />
        <Segmented
          segments={(["threshold", "max_hr", "custom"] as const).map(
            (value) => ({ value, label: h.methods[value] }),
          )}
          value={method}
          onChange={(next) => void changeMethod(next, athlete)}
          theme={theme}
          themeMode={themeMode}
        />
        {zones ? (
          <ListCard theme={theme}>
            {[...zones].reverse().map((zone) => (
              <ZoneRow
                key={zone.zone}
                zone={zone}
                name={h.zoneNames[zone.zone - 1] ?? `Z${zone.zone}`}
                bpm={bpm}
                theme={theme}
                onPress={
                  method === "custom" && zone.zone < 5
                    ? () => openCustomBound(zone.zone - 1, athlete)
                    : undefined
                }
              />
            ))}
          </ListCard>
        ) : (
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              title={reason ? h.unavailable[reason] : h.unavailable.max_missing}
              value={h.specify}
              onPress={fixReason}
            />
          </ListCard>
        )}
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

function currentUpperBounds(
  zones: HrZone[] | null | undefined,
): number[] | null {
  if (!zones || zones.length < 4) return null;
  const bounds = zones.slice(0, 4).map((zone) => zone.max);
  return bounds.every((value): value is number => typeof value === "number")
    ? bounds
    : null;
}

function ZoneRow({
  zone,
  name,
  bpm,
  theme,
  onPress,
}: {
  zone: HrZone;
  name: string;
  bpm: string;
  theme: ThemeTokens;
  onPress?: () => void;
}) {
  const range =
    zone.min === null
      ? `< ${zone.max}`
      : zone.max === null
        ? `> ${zone.min}`
        : `${zone.min}–${zone.max}`;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Z${zone.zone} ${name} ${range} ${bpm}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.zoneRow, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.zoneBar,
          {
            backgroundColor: theme.color.foreground,
            opacity: 0.2 + zone.zone * 0.16,
          },
        ]}
      />
      <Text
        style={[
          styles.zoneLabel,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        Z{zone.zone}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.zoneName,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {name}
      </Text>
      <Text
        style={[
          styles.zoneRange,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {range} {bpm}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zoneRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  zoneBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  zoneLabel: {
    width: 26,
    fontSize: 15,
    lineHeight: 20,
  },
  zoneName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  zoneRange: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
