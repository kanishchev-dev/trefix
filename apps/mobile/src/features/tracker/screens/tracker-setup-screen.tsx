import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import type {
  RecordingEnvironment,
  TrainingWorkout,
  WorkoutType,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Segmented } from "@trefix/ui-native";

import type { AppLanguage, MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { replaceSubScreen } from "../../main/main-routes";
import { useAthleteProfile } from "../../profile/hooks/use-athlete-profile";
import { ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import type { DistanceMode } from "../engine/types";
import { currentUserId } from "../hooks";
import { recorder, TrackerPermissionError } from "../recorder";
import { loadStride } from "../sensors/stride";
import { planRows } from "../plan-format";
import {
  DEFAULT_VOICE_SETTINGS,
  type VoiceInterval,
  type VoiceSettings,
} from "../voice/cues";
import { loadVoiceSettings, saveVoiceSettings } from "../voice/speaker";
import { useWorkoutExecution } from "../../main/hooks/use-workouts";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import { useGpsWarmup, usePlannedWorkout } from "../setup-hooks";
import { styles } from "./tracker-setup-screen.styles";

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

export function TrackerSetupScreen({
  theme,
  themeMode,
  copy,
  language,
  plannedWorkoutId = null,
  onBack,
}: Props) {
  const t = copy.tracker;
  const athlete = useAthleteProfile();
  const format = useUnitFormat(copy, language);
  const paceUnit =
    format.units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const planned = usePlannedWorkout(plannedWorkoutId);
  const [runMode, setRunMode] = useState<RunMode>("plan");
  const execution = useWorkoutExecution(
    planned?.id ?? null,
    runMode === "plan",
  );
  const byPlan = Boolean(planned) && runMode === "plan" && !execution.isError;
  const plan = byPlan ? (execution.data ?? null) : null;
  const rows = useMemo(
    () => (plan ? planRows(plan.steps, t, format.units, paceUnit) : []),
    [format.units, paceUnit, plan, t],
  );
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  useEffect(() => {
    void loadVoiceSettings().then(setVoice);
  }, []);
  const changeVoice = (next: VoiceSettings): void => {
    setVoice(next);
    void saveVoiceSettings(next);
  };
  const [environment, setEnvironment] =
    useState<RecordingEnvironment>("outdoor");
  const [mode, setMode] = useState<DistanceMode>("gps");
  const [workoutType, setWorkoutType] = useState<Exclude<
    WorkoutType,
    "rest"
  > | null>(null);
  const [autoPause, setAutoPause] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    settings: boolean;
  } | null>(null);
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
          ? {
              message: t.permissions[startError.permission],
              settings: startError.permission !== "location_services",
            }
          : { message: t.startFailed, settings: false },
      );
    } finally {
      setStarting(false);
    }
  };

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const hint =
    environment === "treadmill" ? t.modeHints.treadmill : t.modeHints[mode];

  return (
    <ProfileSubScreen
      title={t.setupTitle}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      {planned ? (
        <View style={styles.section}>
          <SectionTitle text={t.planToday} theme={theme} />
          <Segmented
            segments={(["plan", "free"] as const).map((value) => ({
              value,
              label: t.runMode[value],
            }))}
            value={runMode}
            onChange={setRunMode}
            theme={theme}
            themeMode={themeMode}
          />
          {runMode === "plan" ? (
            <View style={styles.plan}>
              <Text
                style={[
                  styles.label,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {workoutTitle(planned, copy)}
              </Text>
              {execution.isPending ? (
                <View style={styles.gpsRow}>
                  <ActivityIndicator
                    size="small"
                    color={theme.color.mutedForeground}
                  />
                  <Text style={[styles.hint, muted]}>{t.planLoading}</Text>
                </View>
              ) : execution.isError ? (
                <Text style={[styles.hint, muted]}>{t.planUnavailable}</Text>
              ) : (
                rows.map((row) => (
                  <View
                    key={row.key}
                    style={[
                      styles.planRow,
                      { borderBottomColor: theme.color.separator },
                    ]}
                  >
                    <Text style={[styles.planLabel, muted]}>{row.label}</Text>
                    <View style={styles.flex}>
                      <Text
                        style={[
                          styles.label,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {row.detail}
                      </Text>
                      {row.pace ? (
                        <Text style={[styles.hint, muted]}>{row.pace}</Text>
                      ) : null}
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
          segments={(["outdoor", "trail", "treadmill"] as const).map(
            (value) => ({ value, label: t.environments[value] }),
          )}
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
            segments={(["gps", "time"] as const).map((value) => ({
              value,
              label: t.modes[value],
            }))}
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
              {
                backgroundColor:
                  gps.status === "good"
                    ? theme.color.success
                    : gps.status === "weak"
                      ? theme.color.warning
                      : theme.color.mutedForeground,
              },
            ]}
          />
          <Text
            style={[
              styles.hint,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {gps.status === "good"
              ? t.gps.good
              : gps.status === "weak"
                ? t.gps.weak
                : t.gps.searching}
          </Text>
        </View>
      ) : null}
      {usesGps && gps.slow ? (
        <Text style={[styles.hint, muted]}>{t.gpsSlowHint}</Text>
      ) : null}

      {byPlan ? null : (
        <View style={styles.section}>
          <SectionTitle text={t.type} theme={theme} />
          <ChipScroller>
            <Chip
              theme={theme}
              label={t.typeFree}
              selected={workoutType === null}
              onPress={() => setWorkoutType(null)}
            />
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
          <Text
            style={[
              styles.label,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {t.autoPause}
          </Text>
          <Text style={[styles.hint, muted]}>{t.autoPauseHint}</Text>
        </View>
        <Switch
          value={autoPause}
          onValueChange={setAutoPause}
          theme={theme}
          accessibilityLabel={t.autoPause}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text
            style={[
              styles.label,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
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
                format.units === "imperial" &&
                (value === "1u" || value === "2u")
                  ? t.voiceIntervalsImperial[value]
                  : t.voiceIntervals[value],
            }))}
            value={voice.interval}
            onChange={(interval) => changeVoice({ ...voice, interval })}
            theme={theme}
            themeMode={themeMode}
          />
          {usesGps ? null : (
            <Text style={[styles.hint, muted]}>{t.keepAliveHint}</Text>
          )}
        </View>
      ) : null}

      {error ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.hint,
              {
                color: theme.color.danger,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {error.message}
          </Text>
          {error.settings ? (
            <SheetButton
              label={t.openSettings}
              variant="secondary"
              onPress={() => void Linking.openSettings()}
              theme={theme}
              themeMode={themeMode}
            />
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
  const title = workoutTargetText(workout.target, "title")?.trim();
  if (title) return title;
  const types = copy.profile.workoutTypes as Record<string, string>;
  return types[workout.type] ?? workout.type;
}
