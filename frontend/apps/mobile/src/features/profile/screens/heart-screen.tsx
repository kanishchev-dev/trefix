import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
  type HrZone,
  type HrZonesMethod,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import { fillTemplate, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import { useToast } from "../../../shared/ui/toast";
import { useActivePlan } from "../../plans/hooks/use-active-plan";
import { zoneColors } from "../components/profile-ui";
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
import { profileErrorMessage, zoneRangeText } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
  /** Custom zone bounds are edited on their own screen. */
  onOpenZones: () => void;
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
export const FALLBACK_CUSTOM_ZONES = [111, 130, 148, 167];

/** Heart rate: resting, max and threshold, the zone method and the zones the server derives. */
export function HeartScreen({
  theme,
  themeMode,
  copy,
  onBack,
  onOpenZones,
}: Props) {
  const { data: athlete } = useAthleteProfile();
  const save = useHeartSave(copy);
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const h = copy.profile.heart;
  const t = copy.profile.heartScreen;
  const bpm = copy.profile.unitLabels.bpm;

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
      clearable: true,
      suggestion: estimate
        ? {
            text: fillTemplate(h.estimate, { value: estimate }),
            actionLabel: t.setEstimate,
            value: estimate,
          }
        : undefined,
      onSave: (value) => save({ [field]: value }),
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
          FALLBACK_CUSTOM_ZONES;
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
    else onOpenZones();
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
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={h.rest}
            value={valueOf("restingHeartRate")}
            valueColor={colorOf("restingHeartRate")}
            chevron={false}
            onPress={() => openValue("restingHeartRate", h.rest, athlete)}
          />
          <ListRow
            theme={theme}
            title={h.max}
            description={
              athlete.maxHeartRateEstimate
                ? fillTemplate(h.estimate, {
                    value: athlete.maxHeartRateEstimate,
                  })
                : undefined
            }
            value={valueOf("maxHeartRate")}
            valueColor={colorOf("maxHeartRate")}
            chevron={false}
            onPress={() => openValue("maxHeartRate", h.max, athlete)}
          />
          <ListRow
            theme={theme}
            title={h.threshold}
            value={valueOf("thresholdHeartRate")}
            valueColor={colorOf("thresholdHeartRate")}
            chevron={false}
            onPress={() =>
              openValue("thresholdHeartRate", h.threshold, athlete)
            }
          />
        </ListCard>
        <Footnote text={h.thresholdHint} theme={theme} />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={h.zones} theme={theme} />
        <SheetTabs
          tabs={(["threshold", "max_hr", "custom"] as const).map((key) => ({
            key,
            label: h.methods[key],
          }))}
          value={method}
          onChange={(next) => void changeMethod(next, athlete)}
          theme={theme}
          trackColor={theme.color.card}
          accessibilityLabel={h.zones}
        />
        {zones ? (
          <ZonesCard
            theme={theme}
            zones={zones}
            names={h.zoneNames}
            copy={copy}
            onPressZone={method === "custom" ? onOpenZones : undefined}
          />
        ) : (
          <ListCard theme={theme} bare>
            <ListRow
              theme={theme}
              title={reason ? h.unavailable[reason] : h.unavailable.max_missing}
              value={h.specify}
              onPress={fixReason}
            />
          </ListCard>
        )}
        <Footnote text={t.planNote} theme={theme} />
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

/** Saves heart fields and tells the user that the coach will propose plan updates. */
export function useHeartSave(copy: MainCopy) {
  const update = useUpdateAthleteProfile();
  const { showToast } = useToast();
  const activePlan = useActivePlan();
  const { preferences } = usePreferences();
  return async (patch: AthleteProfileUpdate) => {
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
      showToast(copy.profile.heart.planNote);
    }
  };
}

export function currentUpperBounds(
  zones: HrZone[] | null | undefined,
): number[] | null {
  if (!zones || zones.length < 4) return null;
  const bounds = zones.slice(0, 4).map((zone) => zone.max);
  return bounds.every((value): value is number => typeof value === "number")
    ? bounds
    : null;
}

function ZonesCard({
  theme,
  zones,
  names,
  copy,
  onPressZone,
}: {
  theme: ThemeTokens;
  zones: HrZone[];
  names: string[];
  copy: MainCopy;
  onPressZone?: () => void;
}) {
  const colors = zoneColors(theme);
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      {zones.map((zone, index) => (
        <Pressable
          key={zone.zone}
          accessibilityRole={onPressZone ? "button" : undefined}
          disabled={!onPressZone}
          onPress={onPressZone}
          style={({ pressed }) => [
            styles.zoneRow,
            index > 0 && {
              borderTopWidth: 1,
              borderTopColor: theme.color.screen,
            },
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[styles.swatch, { backgroundColor: colors[zone.zone - 1] }]}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.zoneTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {`Z${zone.zone} · ${names[zone.zone - 1] ?? ""}`}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.zoneValue,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {zoneRangeText(zone, copy)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  zoneRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swatch: {
    width: 10,
    height: 28,
    borderRadius: 5,
  },
  zoneTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  zoneValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.82,
  },
});
