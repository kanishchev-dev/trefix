import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";

import type { RecordingEnvironment, TrainingWorkout, WorkoutType } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import type { AppLanguage, MainCopy } from "../../../locales";
import { getWorkoutExecution } from "../../../lib/training-api";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useWorkouts } from "../../main/hooks/use-workouts";
import { replaceSubScreen } from "../../main/main-routes";
import { useWorkout } from "../../plans/hooks/use-workout";
import { todayIso, workoutLocalDate } from "../../plans/lib/plan-dates";
import { useAthleteProfile } from "../../profile/hooks/use-athlete-profile";
import { ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import type { DistanceMode } from "../engine/types";
import { currentUserId } from "../hooks";
import { recorder, TrackerPermissionError } from "../recorder";
import { loadStride } from "../sensors/stride";
import { planRows } from "../plan-format";
import { DEFAULT_VOICE_SETTINGS, type VoiceInterval, type VoiceSettings } from "../voice/cues";
import { loadVoiceSettings, saveVoiceSettings } from "../voice/speaker";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  /** Opened from a planned workout: run it step by step. */
  plannedWorkoutId?: string | null;
  onBack: () => void;
};

type RunMode = "plan" | "free";
const VOICE_INTERVALS: VoiceInterval[] = ["1u", "2u", "5min", "10min"];

/** Accuracy at which GPS counts as ready. */
const GPS_READY_M = 15;
/** Without a ready fix for this long, suggest recording by time. */
const GPS_SLOW_HINT_MS = 20_000;

const FREE_TYPES: Array<Exclude<WorkoutType, "rest">> = [
  "easy",
  "long_run",
  "recovery",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "race",
];

export function TrackerSetupScreen({ theme, themeMode, copy, language, plannedWorkoutId = null, onBack }: Props) {
  const t = copy.tracker;
  const athlete = useAthleteProfile();
  const format = useUnitFormat(copy, language);
  const paceUnit = format.units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const planned = usePlannedWorkout(plannedWorkoutId);
  const [runMode, setRunMode] = useState<RunMode>("plan");
  const execution = useQuery({
    queryKey: ["workouts", "execution", planned?.id ?? ""],
    queryFn: () => getWorkoutExecution(planned!.id),
    enabled: Boolean(planned) && runMode === "plan",
    retry: false,
    staleTime: 60_000,
  });
  const byPlan = Boolean(planned) && runMode === "plan" && !execution.isError;
  const plan = byPlan ? execution.data ?? null : null;
  const rows = useMemo(() => (plan ? planRows(plan.steps, t, format.units, paceUnit) : []), [format.units, paceUnit, plan, t]);
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  useEffect(() => {
    void loadVoiceSettings().then(setVoice);
  }, []);
  const changeVoice = (next: VoiceSettings): void => {
    setVoice(next);
    void saveVoiceSettings(next);
  };
  const [environment, setEnvironment] = useState<RecordingEnvironment>("outdoor");
  const [mode, setMode] = useState<DistanceMode>("gps");
  const [workoutType, setWorkoutType] = useState<Exclude<WorkoutType, "rest"> | null>(null);
  const [autoPause, setAutoPause] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ message: string; settings: boolean } | null>(null);
  const usesGps = environment !== "treadmill" && mode === "gps";
  const gps = useGpsWarmup(usesGps);

  const start = async (distanceMode: DistanceMode): Promise<void> => {
    setStarting(true);
    setError(null);
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const strideM = await loadStride(athlete.data?.heightCm ?? null);
      const planType = plan && plan.type !== "rest" ? plan.type : null;
      await recorder.start(
        userId,
        { environment, distanceMode, strideM, autoPause },
        {
          plannedWorkoutId: plan ? plan.workoutId : null,
          plannedTitle: plan && planned ? workoutTitle(planned, copy) : null,
          workoutType: planType ?? workoutType,
          voice: { ...voice, language, units: format.units },
        },
        t.notification,
        plan?.steps ?? null,
      );
      replaceSubScreen({ kind: "tracker-recording" });
    } catch (startError) {
      setError(
        startError instanceof TrackerPermissionError
          ? { message: t.permissions[startError.permission], settings: startError.permission !== "location_services" }
          : { message: t.startFailed, settings: false },
      );
    } finally {
      setStarting(false);
    }
  };

  const muted = { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular };
  const hint = environment === "treadmill" ? t.modeHints.treadmill : t.modeHints[mode];

  return (
    <ProfileSubScreen title={t.setupTitle} onBack={onBack} theme={theme} themeMode={themeMode}>
      {planned ? (
        <View style={styles.section}>
          <SectionTitle text={t.planToday} theme={theme} />
          <Segmented
            segments={(["plan", "free"] as const).map((value) => ({ value, label: t.runMode[value] }))}
            value={runMode}
            onChange={setRunMode}
            theme={theme}
            themeMode={themeMode}
          />
          {runMode === "plan" ? (
            <View style={styles.plan}>
              <Text style={[styles.label, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
                {workoutTitle(planned, copy)}
              </Text>
              {execution.isPending ? (
                <View style={styles.gpsRow}>
                  <ActivityIndicator size="small" color={theme.color.mutedForeground} />
                  <Text style={[styles.hint, muted]}>{t.planLoading}</Text>
                </View>
              ) : execution.isError ? (
                <Text style={[styles.hint, muted]}>{t.planUnavailable}</Text>
              ) : (
                rows.map((row) => (
                  <View key={row.key} style={[styles.planRow, { borderBottomColor: theme.color.separator }]}>
                    <Text style={[styles.planLabel, muted]}>{row.label}</Text>
                    <View style={styles.flex}>
                      <Text style={[styles.label, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
                        {row.detail}
                      </Text>
                      {row.pace ? <Text style={[styles.hint, muted]}>{row.pace}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle text={t.where} theme={theme} />
        <Segmented
          segments={(["outdoor", "trail", "treadmill"] as const).map((value) => ({ value, label: t.environments[value] }))}
          value={environment}
          onChange={setEnvironment}
          theme={theme}
          themeMode={themeMode}
        />
      </View>

      {environment !== "treadmill" ? (
        <View style={styles.section}>
          <SectionTitle text={t.measure} theme={theme} />
          <Segmented
            segments={(["gps", "time"] as const).map((value) => ({ value, label: t.modes[value] }))}
            value={mode}
            onChange={setMode}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      ) : null}
      <Text style={[styles.hint, muted]}>{hint}</Text>

      {usesGps ? (
        <View style={styles.gpsRow}>
          <View
            style={[
              styles.gpsDot,
              { backgroundColor: gps.status === "good" ? theme.color.success : gps.status === "weak" ? theme.color.warning : theme.color.mutedForeground },
            ]}
          />
          <Text style={[styles.hint, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {gps.status === "good" ? t.gps.good : gps.status === "weak" ? t.gps.weak : t.gps.searching}
          </Text>
        </View>
      ) : null}
      {usesGps && gps.slow ? <Text style={[styles.hint, muted]}>{t.gpsSlowHint}</Text> : null}

      {byPlan ? null : (
      <View style={styles.section}>
        <SectionTitle text={t.type} theme={theme} />
        <ChipScroller>
          <Chip theme={theme} label={t.typeFree} selected={workoutType === null} onPress={() => setWorkoutType(null)} />
          {FREE_TYPES.map((type) => (
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
      )}

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {t.autoPause}
          </Text>
          <Text style={[styles.hint, muted]}>{t.autoPauseHint}</Text>
        </View>
        <Switch value={autoPause} onValueChange={setAutoPause} theme={theme} accessibilityLabel={t.autoPause} />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {t.voice}
          </Text>
          <Text style={[styles.hint, muted]}>{t.voiceHint}</Text>
        </View>
        <Switch
          value={voice.enabled}
          onValueChange={(enabled) => changeVoice({ ...voice, enabled })}
          theme={theme}
          accessibilityLabel={t.voice}
        />
      </View>
      {voice.enabled ? (
        <View style={styles.section}>
          <Text style={[styles.hint, muted]}>{t.voiceInterval}</Text>
          <Segmented
            segments={VOICE_INTERVALS.map((value) => ({
              value,
              label:
                format.units === "imperial" && (value === "1u" || value === "2u")
                  ? t.voiceIntervalsImperial[value]
                  : t.voiceIntervals[value],
            }))}
            value={voice.interval}
            onChange={(interval) => changeVoice({ ...voice, interval })}
            theme={theme}
            themeMode={themeMode}
          />
          {usesGps ? null : <Text style={[styles.hint, muted]}>{t.keepAliveHint}</Text>}
        </View>
      ) : null}

      {error ? (
        <View style={styles.section}>
          <Text style={[styles.hint, { color: theme.color.danger, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {error.message}
          </Text>
          {error.settings ? (
            <SheetButton label={t.openSettings} variant="secondary" onPress={() => void Linking.openSettings()} theme={theme} themeMode={themeMode} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <SheetButton
          label={t.start}
          onPress={() => void start(usesGps ? "gps" : "time")}
          pending={starting}
          disabled={byPlan && !plan}
          theme={theme}
          themeMode={themeMode}
        />
        {usesGps && gps.slow ? (
          <SheetButton
            label={t.startByTime}
            variant="secondary"
            onPress={() => void start("time")}
            disabled={starting || (byPlan && !plan)}
            theme={theme}
            themeMode={themeMode}
          />
        ) : null}
      </View>
    </ProfileSubScreen>
  );
}

/** Title of a planned workout as the calendar shows it. */
function workoutTitle(workout: TrainingWorkout, copy: MainCopy): string {
  const title = (workout.target as { title?: unknown } | null)?.title;
  if (typeof title === "string" && title.trim()) return title;
  const types = copy.profile.workoutTypes as Record<string, string>;
  return types[workout.type] ?? workout.type;
}

/**
 * The planned workout to run: the one the user opened, otherwise today's
 * unfinished workout of the plan (not a rest day).
 */
function usePlannedWorkout(plannedWorkoutId: string | null): TrainingWorkout | null {
  const today = todayIso();
  const opened = useWorkout(plannedWorkoutId);
  const todays = useWorkouts(today, today);
  if (plannedWorkoutId) return opened.data ?? null;
  return (
    todays.data?.find(
      (workout) =>
        workoutLocalDate(workout.scheduledAt) === today &&
        (workout.status === "planned" || workout.status === "modified") &&
        workout.type !== "rest",
    ) ?? null
  );
}

/**
 * Starts the GPS before the run so the first fix is ready at "Start". Only
 * when location access was granted earlier: the permission is asked at start.
 */
function useGpsWarmup(enabled: boolean): { status: "searching" | "weak" | "good"; slow: boolean } {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) setSlow(true);
    }, GPS_SLOW_HINT_MS);
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!permission?.granted || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (location) => {
          const value = location.coords.accuracy ?? null;
          setAccuracy(value);
          if (value !== null && value <= GPS_READY_M) {
            ready = true;
            setSlow(false);
          }
        },
      );
      if (cancelled) subscription.remove();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.remove();
      setSlow(false);
    };
  }, [enabled]);

  const status = accuracy === null ? "searching" : accuracy <= GPS_READY_M ? "good" : "weak";
  return { status, slow };
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, lineHeight: 20 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, gap: 2 },
  actions: { gap: 10, paddingTop: 8 },
  plan: { gap: 2, paddingTop: 4 },
  planRow: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  planLabel: { width: 116, fontSize: 15, lineHeight: 20 },
});
