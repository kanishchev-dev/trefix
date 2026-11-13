import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CirclePause,
  LocateFixed,
  MapPin,
  MapPinOff,
  Play,
  Ruler,
  Target,
  Volume2,
} from "lucide-react-native";

import type {
  ExecutionStep,
  RecordingEnvironment,
  TrainingWorkout,
} from "@trefix/api-client";
import { withAlpha, type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
  SheetTabs,
} from "../../../shared/ui/bottom-sheet";
import { SectionTitle } from "../../../shared/ui/list-card";
import { SheetListRow } from "../../../shared/ui/sheet-list";
import { Switch } from "../../../shared/ui/switch";
import { HeaderBackButton, HeaderTitle } from "../../main/components/header";
import { IntensityScale } from "../../main/components/intensity-scale";
import { SectionLayout } from "../../main/components/section-layout";
import {
  defaultGoalDraft,
  GoalEditor,
  goalEstimateText,
  type GoalDraft,
} from "../../main/components/today/goal-editor";
import { StatusBox } from "../../main/components/today/day-event-cards";
import { useHeaderOptions } from "../../main/context/header-context";
import { useWorkoutExecution } from "../../main/hooks/use-workouts";
import { goalPace } from "../../main/lib/goal-estimate";
import { workoutIntensity } from "../../main/lib/workout-intensity";
import { replaceSubScreen } from "../../main/main-routes";
import { InlineError } from "../../plans/components/plans-ui";
import { useCurrentMetrics } from "../../plans/hooks/use-plan-rebuild";
import { useAthleteProfile } from "../../profile/hooks/use-athlete-profile";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { AccessScreen, type AccessKind } from "../components/access-screen";
import { CountdownOverlay } from "../components/countdown-overlay";
import { Glass } from "../components/glass";
import { voiceSummary, VoiceSheet } from "../components/voice-sheet";
import type { DistanceMode } from "../engine/types";
import { formatPaceValue } from "../format";
import { currentUserId } from "../hooks";
import { mapsEnabled, TrackMap } from "../map/track-map";
import { formatStepSize } from "../plan-format";
import { recorder, TrackerPermissionError } from "../recorder";
import { goalFromDraft, goalFromWorkout, goalSteps } from "../run-goal";
import { loadStride } from "../sensors/stride";
import {
  motionAccess,
  readLocationAccess,
  requestLocation,
  requestMotion,
  useGpsWarmup,
  useLocationAccess,
  usePlannedWorkout,
} from "../setup-hooks";
import type { RunGoal } from "../storage/tracker-db";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "../voice/cues";
import { loadVoiceSettings, saveVoiceSettings } from "../voice/speaker";
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
/** Same offset SectionLayout leaves for the floating header. */
const HEADER_OFFSET = 78;
const ENVIRONMENTS: RecordingEnvironment[] = ["outdoor", "trail", "treadmill"];
const EMPTY_LINES = { solid: [], gaps: [] };

/**
 * Before the run: an open top block (the planned workout, the map with the
 * GPS state, the treadmill or the missing-access notice) and one card of
 * recording settings. GPS turns on by itself when allowed; without it the run
 * is counted by the pedometer.
 */
export function TrackerSetupScreen({
  theme,
  themeMode,
  copy,
  language,
  plannedWorkoutId = null,
  onBack,
}: Props) {
  const t = copy.tracker;
  const insets = useSafeAreaInsets();
  const athlete = useAthleteProfile();
  const format = useUnitFormat(copy, language);
  const units = format.units;
  const paceUnit =
    units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const metrics = useCurrentMetrics();

  const planned = usePlannedWorkout(plannedWorkoutId);
  const [runMode, setRunMode] = useState<RunMode>("plan");
  const byPlanned = Boolean(planned) && runMode === "plan";
  const execution = useWorkoutExecution(planned?.id ?? null, byPlanned);
  const plannedGoal = planned ? goalFromWorkout(planned) : null;

  const [environment, setEnvironment] =
    useState<RecordingEnvironment>("outdoor");
  const [autoPause, setAutoPause] = useState(true);
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [freeGoal, setFreeGoal] = useState<GoalDraft>(() => ({
    ...defaultGoalDraft(units),
    goal: "none",
  }));
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(freeGoal);
  const [sheet, setSheet] = useState<"voice" | "goal" | null>(null);
  const [access, setAccess] = useState<AccessKind | null>(null);
  const [countdown, setCountdown] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    settings: boolean;
  } | null>(null);
  const distanceMode = useRef<DistanceMode>("gps");

  useEffect(() => {
    void loadVoiceSettings().then(setVoice);
  }, []);
  const changeVoice = (next: VoiceSettings): void => {
    setVoice(next);
    void saveVoiceSettings(next);
  };

  const location = useLocationAccess();
  const wantsGps = environment !== "treadmill";
  const gps = useGpsWarmup(wantsGps && location.access === "granted");
  const noGps =
    wantsGps &&
    (location.access === "denied" || location.access === "services_off");
  const searching = wantsGps && !noGps && gps.status !== "good";

  const changeEnvironment = (next: RecordingEnvironment) => {
    setEnvironment(next);
    // On a treadmill the belt keeps the legs moving: auto-pause is off by default.
    setAutoPause(next !== "treadmill");
  };

  const typeLabels = copy.plan.creation.workoutTypes as Record<
    string,
    string | undefined
  >;
  const runGoal: RunGoal | null = byPlanned
    ? plannedGoal
    : goalFromDraft(freeGoal, units);
  const steps: ExecutionStep[] | null = useMemo(() => {
    if (byPlanned) {
      if (plannedGoal) return goalSteps(plannedGoal, planned?.type ?? null);
      const fromServer = execution.data?.steps ?? [];
      return fromServer.length > 0 ? fromServer : null;
    }
    return runGoal ? goalSteps(runGoal, null) : null;
  }, [byPlanned, execution.data, planned?.type, plannedGoal, runGoal]);

  const plannedTitle = planned ? workoutTitle(planned, copy) : null;
  const runTitle =
    byPlanned && plannedTitle
      ? plannedTitle
      : environment === "treadmill"
        ? t.treadmillTitle
        : t.freeTitle;

  const goalText = (goal: RunGoal | null): string | null => {
    if (!goal) return null;
    if (goal.kind === "duration")
      return format.minutes(Math.round((goal.durationSec ?? 0) / 60));
    const distance = format.distance((goal.distanceM ?? 0) / 1000);
    return goal.timeLimitSec
      ? `${distance} ${fillTemplate(t.goalSub.limit, {
          limit: format.minutes(Math.round(goal.timeLimitSec / 60)),
        })}`
      : distance;
  };

  const freeGoalValue = (() => {
    const goal = goalFromDraft(freeGoal, units);
    if (!goal) return t.goalValue.none;
    const value =
      goal.kind === "duration"
        ? format.minutes(Math.round((goal.durationSec ?? 0) / 60))
        : format.distance((goal.distanceM ?? 0) / 1000);
    return goal.kind === "duration"
      ? fillTemplate(t.goalValue.duration, { value })
      : fillTemplate(t.goalValue.distance, { value });
  })();

  // --- Start: access explained first, then 3-2-1, then the recording.
  const beginCountdown = (mode: DistanceMode) => {
    distanceMode.current = mode;
    setCountdown(true);
  };

  const continueWithoutGps = async () => {
    const motion = await motionAccess();
    if (motion === "ask") {
      setAccess("motion");
      return;
    }
    beginCountdown("time");
  };

  const pressStart = async () => {
    setError(null);
    if (wantsGps) {
      // The state may still be loading or stale: ask the system right now.
      const current = await readLocationAccess();
      if (current === "ask") {
        setAccess("location");
        return;
      }
      if (current === "granted") {
        beginCountdown("gps");
        return;
      }
    }
    await continueWithoutGps();
  };

  const allowAccess = async () => {
    const kind = access;
    setAccess(null);
    if (kind === "location") {
      const granted = await requestLocation();
      location.refresh();
      if (granted) beginCountdown("gps");
      else await continueWithoutGps();
      return;
    }
    await requestMotion();
    beginCountdown("time");
  };

  const skipAccess = async () => {
    const kind = access;
    setAccess(null);
    if (kind === "location") await continueWithoutGps();
    else beginCountdown("time");
  };

  const start = async (): Promise<void> => {
    setCountdown(false);
    setStarting(true);
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const strideM = await loadStride(athlete.data?.heightCm ?? null);
      const planType =
        byPlanned && planned && planned.type !== "rest" ? planned.type : null;
      await recorder.start(
        userId,
        {
          environment,
          distanceMode:
            environment === "treadmill" ? "time" : distanceMode.current,
          strideM,
          autoPause,
        },
        {
          plannedWorkoutId: byPlanned && planned ? planned.id : null,
          plannedTitle: byPlanned ? plannedTitle : null,
          workoutType: planType,
          voice: { ...voice, language, units },
          goal: runGoal,
        },
        t.notification,
        steps,
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

  const countdownSubtitle = (() => {
    if (runGoal)
      return fillTemplate(t.card.goalTime, { value: goalText(runGoal) ?? "" });
    const first = steps && steps.length > 1 ? steps[0] : null;
    if (!first) return null;
    return fillTemplate(t.countdown.firstStep, {
      step: [t.stepKinds[first.kind].toLowerCase(), formatStepSize(first, t)]
        .filter(Boolean)
        .join(" "),
    });
  })();

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      ),
      centerContent: <HeaderTitle theme={theme}>{t.setupTitle}</HeaderTitle>,
      rightAction: null,
      variant: "default",
      bottomContent: null,
      tone: "surface",
    },
    [theme, themeMode, onBack, t.setupTitle],
  );

  const headerSpace = insets.top + HEADER_OFFSET;
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const iconProps = {
    size: 20,
    color: theme.color.foreground,
    strokeWidth: 1.9,
  };
  const gpsPillText =
    gps.status === "good"
      ? t.gpsPill.ready
      : gps.accuracy !== null
        ? fillTemplate(t.gpsPill.searchingAccuracy, {
            metres: Math.round(gps.accuracy),
          })
        : t.gpsPill.searching;
  const planLoading = byPlanned && !plannedGoal && execution.isPending;

  const gpsPill = (glass: boolean) => {
    const content = (
      <>
        {gps.status === "good" ? (
          <LocateFixed
            size={16}
            color={theme.color.foreground}
            strokeWidth={2}
          />
        ) : (
          <View
            style={[
              styles.dot,
              { backgroundColor: theme.color.mutedForeground },
            ]}
          />
        )}
        <Text numberOfLines={1} style={[styles.pillText, strong]}>
          {gpsPillText}
        </Text>
      </>
    );
    return glass ? (
      <Glass theme={theme} style={[styles.pill, styles.pillOnMap]}>
        {content}
      </Glass>
    ) : (
      <View style={[styles.pill, { backgroundColor: theme.color.screen }]}>
        {content}
      </View>
    );
  };

  const planHero = planned ? (
    <>
      <IntensityScale
        theme={theme}
        level={workoutIntensity(planned.type)}
        size="hero"
      />
      <View style={styles.kickerRow}>
        <Text
          numberOfLines={1}
          style={[styles.kicker, muted, { fontFamily: strong.fontFamily }]}
        >
          {planned.planId && planned.weekNumber
            ? fillTemplate(t.kicker.week, { number: planned.weekNumber })
            : t.kicker.own}
        </Text>
        <StatusBox
          theme={theme}
          status="planned"
          label={copy.today.workout.statuses.planned}
        />
      </View>
      <Text numberOfLines={1} style={[styles.planTitle, strong]}>
        {plannedTitle}
      </Text>
      <PlannedVolume
        workout={planned}
        goal={plannedGoal}
        copy={copy}
        format={format}
        theme={theme}
      />
      <Text numberOfLines={1} style={[styles.meta, muted]}>
        {[
          typeLabels[planned.type],
          copy.today.workout.intensity[workoutIntensity(planned.type)],
          plannedGoal ? corridorText(plannedGoal) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {wantsGps && !noGps ? (
        <View style={styles.pillRow}>{gpsPill(false)}</View>
      ) : null}
    </>
  ) : null;

  function corridorText(goal: RunGoal): string | null {
    if (goal.kind !== "distance") return t.noCorridor;
    const corridor =
      goal.distanceM && goal.timeLimitSec
        ? goalPace(goal.distanceM / 1000, goal.timeLimitSec / 60)
        : null;
    return corridor
      ? fillTemplate(t.corridorRange, {
          min: formatPaceValue(corridor.min, units),
          max: formatPaceValue(corridor.max, units),
        })
      : t.noCorridor;
  }

  const freeSub = (() => {
    const goal = goalFromDraft(freeGoal, units);
    if (goal) {
      return fillTemplate(t.heroSub.goal, {
        goal: goalText(goal) ?? "",
        estimate: goalEstimateText(
          freeGoal,
          "easy",
          metrics.data?.thresholdPaceSecondsPerKm.value ?? null,
          { copy, format, paceUnit },
        ),
      });
    }
    return searching ? t.heroSub.searching : t.heroSub.ready;
  })();

  const freeHero =
    environment === "treadmill" ? (
      <>
        <TreadmillArt theme={theme} />
        <Text style={[styles.freeTitle, strong]}>{t.treadmillTitle}</Text>
        <Text numberOfLines={1} style={[styles.sub, muted]}>
          {t.heroSub.treadmill}
        </Text>
      </>
    ) : noGps ? (
      <>
        <View style={[styles.alert, { backgroundColor: theme.color.screen }]}>
          <View style={styles.alertHead}>
            <MapPinOff {...iconProps} />
            <Text numberOfLines={1} style={[styles.alertTitle, strong]}>
              {location.access === "services_off"
                ? t.noGps.servicesTitle
                : t.noGps.title}
            </Text>
          </View>
          <Text style={[styles.alertBody, muted]}>
            {location.access === "services_off"
              ? t.noGps.servicesBody
              : t.noGps.body}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [
              styles.alertButton,
              { backgroundColor: theme.color.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.alertButtonText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: strong.fontFamily,
                },
              ]}
            >
              {t.openSettings}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.freeTitle, strong]}>{t.freeTitle}</Text>
        <Text numberOfLines={1} style={[styles.sub, muted]}>
          {t.heroSub.ready}
        </Text>
      </>
    ) : (
      <>
        <View style={[styles.map, { backgroundColor: theme.color.screen }]}>
          {mapsEnabled && location.access === "granted" ? (
            <TrackMap
              theme={theme}
              lines={EMPTY_LINES}
              markers={[]}
              mode="follow"
              interactive={false}
              style={styles.mapFill}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <MapPin
                size={28}
                color={theme.color.mutedForeground}
                strokeWidth={1.6}
              />
            </View>
          )}
          {gpsPill(true)}
        </View>
        <Text style={[styles.freeTitle, strong]}>{t.freeTitle}</Text>
        <Text numberOfLines={1} style={[styles.sub, muted]}>
          {freeSub}
        </Text>
      </>
    );

  const rows: React.ReactNode[] = [];
  rows.push(
    <View key="where" style={styles.row}>
      <MapPin {...iconProps} />
      <Text numberOfLines={1} style={[styles.rowTitle, strong]}>
        {t.whereShort}
      </Text>
      <View>
        <SheetTabs
          compact
          compactWidth={216}
          value={environment}
          onChange={changeEnvironment}
          trackColor={theme.color.screen}
          theme={theme}
          accessibilityLabel={t.where}
          tabs={ENVIRONMENTS.map((key) => ({
            key,
            label: t.environments[key],
          }))}
        />
      </View>
    </View>,
  );
  if (!byPlanned) {
    rows.push(
      <SheetListRow
        key="goal"
        theme={theme}
        icon={<Target {...iconProps} />}
        title={t.goal}
        value={freeGoalValue}
        valueStrong={freeGoal.goal !== "none"}
        chevron
        onPress={() => {
          setGoalDraft(freeGoal);
          setSheet("goal");
        }}
      />,
    );
  }
  if (environment === "treadmill") {
    rows.push(
      <SheetListRow
        key="distance"
        theme={theme}
        icon={<Ruler {...iconProps} />}
        title={t.distanceRow}
        value={t.pedometer}
      />,
    );
  }
  rows.push(
    <SheetListRow
      key="autopause"
      theme={theme}
      icon={<CirclePause {...iconProps} />}
      title={t.autoPause}
      trailing={
        <Switch
          value={autoPause}
          onValueChange={setAutoPause}
          theme={theme}
          accessibilityLabel={t.autoPause}
        />
      }
    />,
    <SheetListRow
      key="voice"
      theme={theme}
      icon={<Volume2 {...iconProps} />}
      title={t.voiceShort}
      value={voiceSummary(voice, units, copy)}
      chevron
      onPress={() => setSheet("voice")}
    />,
  );

  return (
    <View style={styles.root}>
      <SectionLayout
        hasHeader={false}
        scrollable
        theme={theme}
        themeMode={themeMode}
        contentStyle={styles.content}
      >
        <View
          style={[
            styles.hero,
            {
              marginTop: -headerSpace,
              paddingTop: headerSpace + 8,
              backgroundColor: theme.color.card,
            },
          ]}
        >
          {planned ? (
            <View style={styles.modeTabs}>
              <SheetTabs
                value={runMode}
                onChange={setRunMode}
                trackColor={theme.color.screen}
                theme={theme}
                tabs={(["plan", "free"] as const).map((key) => ({
                  key,
                  label: t.runMode[key],
                }))}
              />
            </View>
          ) : null}
          {byPlanned ? planHero : freeHero}
        </View>

        <View style={styles.section}>
          <SectionTitle text={t.recordSection} theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.color.card }]}>
            {rows.map((row, index) => (
              <View
                key={index}
                style={
                  index > 0
                    ? { borderTopWidth: 1, borderTopColor: theme.color.screen }
                    : null
                }
              >
                {row}
              </View>
            ))}
          </View>
          {byPlanned && !plannedGoal && execution.isError ? (
            <Text style={[styles.hint, muted]}>{t.planUnavailable}</Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.section}>
            <InlineError message={error.message} theme={theme} />
            {error.settings ? (
              <SheetButton
                label={t.openSettings}
                variant="secondary"
                onPress={() => void Linking.openSettings()}
                theme={theme}
                themeMode={themeMode}
                style={styles.inlineButton}
              />
            ) : null}
          </View>
        ) : null}
      </SectionLayout>

      <LinearGradient
        pointerEvents="box-none"
        colors={[
          withAlpha(theme.color.screen, 0),
          theme.color.screen,
          theme.color.screen,
        ]}
        locations={[0, 0.4, 1]}
        style={[styles.startBar, { paddingBottom: insets.bottom + 8 }]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={starting || planLoading}
          onPress={() => void pressStart()}
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: theme.color.primary },
            (starting || planLoading) && styles.busy,
            pressed && styles.pressed,
          ]}
        >
          <Play
            size={18}
            color={theme.color.primaryForeground}
            fill={theme.color.primaryForeground}
          />
          <Text
            style={[
              styles.startText,
              {
                color: theme.color.primaryForeground,
                fontFamily: strong.fontFamily,
              },
            ]}
          >
            {noGps ? t.startByTime : t.start}
          </Text>
        </Pressable>
      </LinearGradient>

      <VoiceSheet
        visible={sheet === "voice"}
        settings={voice}
        onChange={changeVoice}
        onClose={() => setSheet(null)}
        units={units}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <GoalSheet
        visible={sheet === "goal"}
        draft={goalDraft}
        onChange={setGoalDraft}
        onDone={() => setFreeGoal(goalDraft)}
        onClose={() => setSheet(null)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />

      <AccessScreen
        kind={access}
        onAllow={() => void allowAccess()}
        onSkip={() => void skipAccess()}
        copy={copy}
        theme={theme}
      />

      <CountdownOverlay
        visible={countdown}
        title={runTitle}
        subtitle={countdownSubtitle}
        onDone={() => void start()}
        onCancel={() => setCountdown(false)}
        copy={copy}
        theme={theme}
      />
    </View>
  );
}

/** Big value of the planned workout: the goal of an own workout, distance and time of a plan one. */
function PlannedVolume({
  workout,
  goal,
  copy,
  format,
  theme,
}: {
  workout: TrainingWorkout;
  goal: RunGoal | null;
  copy: MainCopy;
  format: ReturnType<typeof useUnitFormat>;
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  let value: string;
  let sub: string;
  if (goal?.kind === "duration") {
    value = format.minutes(Math.round((goal.durationSec ?? 0) / 60));
    sub = t.goalSub.duration;
  } else if (goal?.kind === "distance") {
    value = format.distance((goal.distanceM ?? 0) / 1000);
    sub = goal.timeLimitSec
      ? fillTemplate(t.goalSub.limit, {
          limit: format.minutes(Math.round(goal.timeLimitSec / 60)),
        })
      : t.goalSub.distance;
  } else if (
    !workout.planId &&
    workout.distanceKm <= 0 &&
    workout.durationMinutes <= 0
  ) {
    value = t.goalNone;
    sub = "";
  } else {
    value =
      workout.distanceKm > 0
        ? format.distance(workout.distanceKm)
        : format.minutes(Math.round(workout.durationMinutes));
    sub =
      workout.distanceKm > 0 && workout.durationMinutes > 0
        ? format.minutes(Math.round(workout.durationMinutes))
        : "";
  }
  return (
    <View style={styles.volume}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[
          styles.volumeValue,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          numberOfLines={1}
          style={[
            styles.volumeSub,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** A treadmill drawn in the app greys: belt, deck, post and console. */
function TreadmillArt({ theme }: { theme: ThemeTokens }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tread, { backgroundColor: theme.color.screen }]}
    >
      <View
        style={[styles.treadPost, { backgroundColor: theme.color.intensity2 }]}
      />
      <View
        style={[styles.treadPanel, { backgroundColor: theme.color.card }]}
      />
      <View
        style={[styles.treadBelt, { backgroundColor: theme.color.intensity1 }]}
      >
        {Array.from({ length: 9 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.treadMark,
              { left: 14 + index * 36, backgroundColor: theme.color.card },
            ]}
          />
        ))}
      </View>
      <View
        style={[styles.treadDeck, { backgroundColor: theme.color.intensity2 }]}
      />
    </View>
  );
}

/** The goal of a free run, set before the start. */
function GoalSheet({
  visible,
  draft,
  onChange,
  onDone,
  onClose,
  theme,
  themeMode,
  copy,
  language,
}: {
  visible: boolean;
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
  onDone: () => void;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);
  return (
    <BottomSheet
      title={copy.tracker.goalSheetTitle}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <GoalEditor
          draft={draft}
          onChange={onChange}
          workoutType="easy"
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
        />
        <SheetBlock theme={theme}>
          <View style={styles.sheetButtons}>
            <SheetButton
              label={copy.tracker.done}
              onPress={() => {
                onDone();
                setOpen(false);
              }}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

/** Title of a planned workout as the calendar shows it. */
function workoutTitle(workout: TrainingWorkout, copy: MainCopy): string {
  const title = workoutTargetText(workout.target, "title")?.trim();
  if (title) return title;
  const types = copy.profile.workoutTypes as Record<string, string>;
  return types[workout.type] ?? workout.type;
}
