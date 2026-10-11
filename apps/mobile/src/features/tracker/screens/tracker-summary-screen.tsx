import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { WorkoutType } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Ruler } from "@workspace/ui-native";

import appConfig from "../../../../app.json";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { openTab } from "../../main/main-routes";
import { ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { useAthleteProfile } from "../../profile/hooks/use-athlete-profile";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { buildRunExport, exportRun } from "../health-export";
import { useSummaryHealth } from "../use-summary-health";
import { buildSplits } from "../engine/summary";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { formatStepSize } from "../plan-format";
import { TrackMap } from "../map/track-map";
import { useTrackLines } from "../map/use-track-lines";
import { useRecorder, useUploadQueue } from "../hooks";
import { recorder } from "../recorder";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

const WORKOUT_TYPES: Array<Exclude<WorkoutType, "rest">> = [
  "easy",
  "long_run",
  "recovery",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "race",
];

/** Finish screen: the run's numbers, corrections and how it felt, then save or delete. */
export function TrackerSummaryScreen({
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const t = copy.tracker;
  const snapshot = useRecorder();
  const state = recorder.getState();
  const format = useUnitFormat(copy, language);
  const upload = useUploadQueue(copy);
  const { showToast } = useToast();
  const athlete = useAthleteProfile();
  const health = useSummaryHealth(
    state?.startedAt ?? null,
    state ? (state.endedAt ?? state.clock) : null,
  );
  const store =
    health.source?.provider === "apple_health"
      ? copy.profile.integrations.health.appleTitle
      : copy.profile.integrations.health.connectTitle;

  const measuredM = Math.round(state?.distanceM ?? 0);
  const byPedometer = state
    ? state.config.environment === "treadmill" ||
      state.config.distanceMode === "time" ||
      state.gpsDistanceM <= 0
    : false;
  const [distanceM, setDistanceM] = useState(measuredM);
  const [workoutType, setWorkoutType] = useState<Exclude<
    WorkoutType,
    "rest"
  > | null>(snapshot?.meta.workoutType ?? null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const track = recorder.getTrack();
  const { lines, markers } = useTrackLines(
    track,
    format.units,
    snapshot?.trackSize ?? 0,
  );

  const splits = useMemo(
    () =>
      state ? buildSplits(state.timeline, state.distanceM, distanceM) : [],
    [distanceM, state],
  );

  if (!state || !snapshot) return null;

  const movingSec = Math.max(1, Math.round(state.movingMs / 1000));
  const laps = state.plan?.laps ?? [];
  const avgPace = distanceM > 0 ? (movingSec / distanceM) * 1000 : null;
  const distanceUnit =
    format.units === "imperial" ? format.labels.mi : format.labels.km;
  const paceUnit =
    format.units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const text = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      // The recorder forgets the session once it is saved: take what Health needs first.
      const run =
        health.source && health.exportEnabled
          ? buildRunExport(
              snapshot.sessionId,
              state,
              [...track],
              distanceM,
              athlete.data?.weightKg,
            )
          : null;
      const sessionId = await recorder.save(
        {
          distanceM: distanceM !== measuredM ? distanceM : null,
          workoutType,
          plannedWorkoutId: snapshot.meta.plannedWorkoutId,
          heartRate: health.heartRate,
          feeling,
          rpe,
          notes,
        },
        {
          appVersion: appConfig.expo.version,
          model:
            Platform.OS === "android"
              ? String(Platform.constants.Model ?? "")
              : undefined,
        },
      );
      const outcomes = await upload();
      const mine = outcomes.find((outcome) => outcome.sessionId === sessionId);
      if (!mine || mine.status === "uploaded") showToast(t.saved);
      else if (mine.status === "retry") showToast(t.savedOffline);
      if (run && health.source) {
        const outcome = await exportRun(health.source, run);
        if (outcome === "denied")
          showToast(fillTemplate(t.healthDenied, { store }));
        else if (outcome === "failed")
          showToast(fillTemplate(t.healthFailed, { store }));
      }
      openTab("today");
    } finally {
      setSaving(false);
    }
  };

  const discard = (): void => {
    Alert.alert(t.discardTitle, t.discardBody, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.discardConfirm,
        style: "destructive",
        onPress: () => {
          void recorder.discard().then(() => openTab("today"));
        },
      },
    ]);
  };

  const stats: Array<{ label: string; value: string; unit?: string }> = [
    { label: t.metrics.time, value: formatClock(state.movingMs) },
    {
      label: t.metrics.distance,
      value: formatDistanceValue(distanceM, format.units, format.locale),
      unit: distanceUnit,
    },
    {
      label: t.metrics.avgPace,
      value: formatPaceValue(avgPace, format.units),
      unit: paceUnit,
    },
  ];
  if (state.gpsDistanceM > 0 || state.elevation.source === "baro")
    stats.push({
      label: t.metrics.elevation,
      value: String(Math.round(state.elevation.gainM)),
      unit: t.metrics.metres,
    });
  if (health.heartRate) {
    stats.push(
      {
        label: t.metrics.heartRate,
        value: String(health.heartRate.avg),
        unit: t.metrics.bpm,
      },
      {
        label: t.metrics.maxHeartRate,
        value: String(health.heartRate.max),
        unit: t.metrics.bpm,
      },
    );
  }
  if (state.steps > 0 && state.movingMs >= 60_000) {
    stats.push({
      label: t.metrics.cadence,
      value: String(Math.round(state.steps / (state.movingMs / 60_000))),
      unit: t.metrics.spm,
    });
  }

  return (
    <ProfileSubScreen
      title={t.summaryTitle}
      onBack={() => openTab("today")}
      theme={theme}
      themeMode={themeMode}
    >
      {track.length >= 2 ? (
        <TrackMap
          theme={theme}
          lines={lines}
          markers={markers}
          mode="fit"
          points={track}
          interactive={false}
          style={styles.map}
        />
      ) : null}
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statLabel, muted]}>{stat.label}</Text>
            <View style={styles.valueRow}>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {stat.value}
              </Text>
              {stat.unit ? (
                <Text style={[styles.statUnit, muted]}>{stat.unit}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {byPedometer ? (
        <View style={styles.section}>
          <SectionTitle
            text={
              state.config.environment === "treadmill"
                ? t.distanceTreadmill
                : t.distanceTime
            }
            theme={theme}
          />
          <View style={styles.bleed}>
            <Ruler
              value={
                Math.round(kmToDisplay(distanceM / 1000, format.units) * 100) /
                100
              }
              onChange={(value) =>
                setDistanceM(
                  Math.max(
                    0,
                    Math.round(displayToKm(value, format.units) * 1000),
                  ),
                )
              }
              min={0}
              max={format.units === "imperial" ? 62 : 100}
              step={0.01}
              majorEvery={0.1}
              labelEvery={0.5}
              unit={distanceUnit}
              accessibilityLabel={t.metrics.distance}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </View>
      ) : null}

      {splits.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle text={t.splits} theme={theme} />
          <View
            style={[
              styles.splitRow,
              { borderBottomColor: theme.color.separator },
            ]}
          >
            <Text style={[styles.splitKm, muted]}>{t.splitKm}</Text>
            <Text style={[styles.splitPace, muted]}>{t.splitPace}</Text>
            <Text style={[styles.splitElevation, muted]}>
              {t.splitElevation}
            </Text>
          </View>
          {splits.map((split) => (
            <View
              key={split.km}
              style={[
                styles.splitRow,
                { borderBottomColor: theme.color.separator },
              ]}
            >
              <Text style={[styles.splitKm, text]}>
                {split.partial ? `${split.km}*` : split.km}
              </Text>
              <Text style={[styles.splitPace, text]}>
                {formatPaceValue(split.paceSecPerKm, format.units)}
              </Text>
              <Text style={[styles.splitElevation, muted]}>
                {split.elevationGainM != null &&
                (state.gpsDistanceM > 0 || state.elevation.source === "baro")
                  ? `+${split.elevationGainM}`
                  : "–"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {laps.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle text={t.laps} theme={theme} />
          <View
            style={[
              styles.splitRow,
              { borderBottomColor: theme.color.separator },
            ]}
          >
            <Text style={[styles.lapName, muted]} />
            <Text style={[styles.lapCell, muted]}>{t.lapPlanned}</Text>
            <Text style={[styles.lapCell, muted]}>{t.lapActual}</Text>
            <Text style={[styles.lapPace, muted]}>{t.splitPace}</Text>
          </View>
          {laps.map((lap) => {
            const planned =
              formatStepSize(
                {
                  durationSec: lap.plannedSec ?? null,
                  distanceM: lap.plannedM ?? null,
                },
                t,
              ) ?? "–";
            const actual =
              lap.plannedM != null
                ? formatStepSize(
                    { durationSec: null, distanceM: lap.actualM },
                    t,
                  )
                : formatClock(lap.actualSec * 1000);
            const paceColor =
              lap.inTarget === true
                ? theme.color.success
                : lap.inTarget === false
                  ? theme.color.warning
                  : theme.color.foreground;
            return (
              <View
                key={`${lap.index}-${lap.actualSec}`}
                style={[
                  styles.splitRow,
                  { borderBottomColor: theme.color.separator },
                ]}
              >
                <Text style={[styles.lapName, text]} numberOfLines={1}>
                  {t.stepKinds[lap.kind as keyof typeof t.stepKinds] ??
                    lap.kind}
                </Text>
                <Text style={[styles.lapCell, muted]}>{planned}</Text>
                <Text style={[styles.lapCell, text]}>{actual}</Text>
                <Text style={[styles.lapPace, text, { color: paceColor }]}>
                  {formatPaceValue(lap.avgPaceSecPerKm ?? null, format.units)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle text={t.type} theme={theme} />
        <ChipScroller>
          <Chip
            theme={theme}
            label={t.typeFree}
            selected={workoutType === null}
            onPress={() => setWorkoutType(null)}
          />
          {WORKOUT_TYPES.map((type) => (
            <Chip
              key={type}
              theme={theme}
              label={copy.profile.workoutTypes[type]}
              selected={workoutType === type}
              onPress={() => setWorkoutType(type)}
            />
          ))}
        </ChipScroller>
      </View>

      <View style={styles.section}>
        <SectionTitle text={t.feeling} theme={theme} />
        <ChipScroller>
          {t.feelings.map((label, index) => (
            <Chip
              key={label}
              theme={theme}
              label={label}
              selected={feeling === index + 1}
              onPress={() =>
                setFeeling(feeling === index + 1 ? null : index + 1)
              }
            />
          ))}
        </ChipScroller>
      </View>

      <View style={styles.section}>
        <SectionTitle text={t.rpe} theme={theme} />
        <ChipScroller>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <Chip
              key={value}
              theme={theme}
              label={String(value)}
              selected={rpe === value}
              onPress={() => setRpe(rpe === value ? null : value)}
            />
          ))}
        </ChipScroller>
      </View>

      <View style={styles.section}>
        <SectionTitle text={t.notes} theme={theme} />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t.notesPlaceholder}
          placeholderTextColor={theme.color.mutedForeground}
          multiline
          maxLength={2000}
          style={[
            styles.notes,
            {
              color: theme.color.foreground,
              backgroundColor: theme.color.control,
              borderColor: theme.color.controlBorder,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        />
      </View>

      {health.source ? (
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[styles.switchLabel, text]}>
              {fillTemplate(t.healthExport, { store })}
            </Text>
            <Text style={[styles.switchHint, muted]}>
              {fillTemplate(t.healthExportHint, { store })}
            </Text>
          </View>
          <Switch
            value={health.exportEnabled}
            onValueChange={health.setExportEnabled}
            theme={theme}
            accessibilityLabel={fillTemplate(t.healthExport, { store })}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <SheetButton
          label={t.save}
          onPress={() => void save()}
          pending={saving}
          theme={theme}
          themeMode={themeMode}
        />
        <SheetButton
          label={t.discard}
          variant="destructive"
          onPress={discard}
          disabled={saving}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  map: { height: 220 },
  stat: { width: "50%", gap: 2 },
  statLabel: { fontSize: 13, lineHeight: 18 },
  statValue: { fontSize: 28, lineHeight: 34, fontVariant: ["tabular-nums"] },
  statUnit: { fontSize: 14, lineHeight: 18, marginLeft: 4, marginBottom: 5 },
  valueRow: { flexDirection: "row", alignItems: "flex-end" },
  section: { gap: 10 },
  bleed: { marginHorizontal: -16 },
  splitRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  splitKm: { width: 48, fontSize: 15, lineHeight: 20 },
  splitPace: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  splitElevation: {
    width: 64,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 20,
  },
  lapName: { flex: 1, fontSize: 15, lineHeight: 20 },
  lapCell: {
    width: 68,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  lapPace: {
    width: 56,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  notes: {
    minHeight: 88,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    fontSize: 15,
    textAlignVertical: "top",
  },
  actions: { gap: 10, paddingTop: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, lineHeight: 20 },
  switchHint: { fontSize: 13, lineHeight: 18 },
});
