import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Activity,
  ChartLine,
  Check,
  CirclePause,
  Clock3,
  Footprints,
  Gauge,
  LocateFixed,
  Lock,
  MapPinOff,
  Mountain,
  Pause,
  Play,
  Ruler,
  Timer,
  Volume2,
} from "lucide-react-native";

import type { ExecutionStep } from "@trefix/api-client";
import { withAlpha, type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import {
  SheetBadge,
  SheetList,
  SheetListRow,
  SheetSubtitle,
} from "../../../shared/ui/sheet-list";
import { openTab, replaceSubScreen } from "../../main/main-routes";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { Glass } from "../components/glass";
import { HoldButton } from "../components/hold-button";
import {
  DistanceGoalCard,
  MetricGrid,
  PlanCard,
  StepDoneCard,
  StepsList,
  TimeGoalCard,
  type Fmt,
  type MetricCell,
} from "../components/recording-cards";
import { VoiceSheet } from "../components/voice-sheet";
import type { EngineView } from "../engine/types";
import type { RunGoal } from "../storage/tracker-db";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { useRecorder } from "../hooks";
import { mapsEnabled, TrackMap } from "../map/track-map";
import { useTrackLines } from "../map/use-track-lines";
import { recorder } from "../recorder";
import {
  DEFAULT_CELLS,
  lastUnitPace,
  loadCells,
  METRIC_KEYS,
  pauseDurationMs,
  saveCells,
  type MetricKey,
} from "../recording-metrics";
import { DEFAULT_VOICE_SETTINGS } from "../voice/cues";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

type Page = "metrics" | "map" | "steps";
type RunSheet = "goalDone" | "short" | "metric" | "voice" | null;

/** Shorter than both is not a workout. */
const SHORT_RUN_M = 200;
const SHORT_RUN_MS = 60_000;
/** How long the "step done" card stays. */
const STEP_DONE_SEC = 3;
const GPS_TOAST_MS = 6_000;
const METRES_PER_MILE = 1609.344;

/**
 * Live recording in the app theme: a glass status pill, pages of metrics,
 * map and plan steps, a wide "Pause" with a lock, the voice button top right.
 * Paused, "Finish" is held to end the run.
 */
export function TrackerRecordingScreen({
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  useKeepAwake();
  const t = copy.tracker;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [size, setSize] = useState({
    width: window.width,
    height: window.height,
  });
  const width = size.width;
  const snapshot = useRecorder();
  const state = recorder.getState();
  const format = useUnitFormat(copy, language);
  const [locked, setLocked] = useState(false);
  const [page, setPage] = useState(0);
  const [cells, setCells] = useState<MetricKey[]>(DEFAULT_CELLS);
  const [editingCell, setEditingCell] = useState(0);
  const [sheet, setSheet] = useState<RunSheet>(null);
  const [stepDone, setStepDone] = useState<{
    lapIndex: number;
    left: number;
  } | null>(null);
  const [gpsToast, setGpsToast] = useState(false);
  const pager = useRef<ScrollView>(null);
  const prevView = useRef<EngineView | null>(null);
  const runSheetKind = useRef<"short" | "goalDone">("goalDone");

  const { lines, markers } = useTrackLines(
    recorder.getTrack(),
    format.units,
    snapshot?.trackSize ?? 0,
  );

  useEffect(() => {
    void loadCells().then(setCells);
  }, []);

  // The recording is left only through "Finish": the system back gesture must not drop it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, []);

  const view = snapshot?.view ?? null;
  useEffect(() => {
    if (view?.status === "finished")
      replaceSubScreen({ kind: "tracker-summary" });
  }, [view?.status]);

  // Moments worth a card or a sheet: a step done, the goal reached, GPS lost.
  useEffect(() => {
    if (!view) return;
    const prev = prevView.current;
    prevView.current = view;
    if (!prev) return;
    const laps = recorder.getState()?.plan?.laps ?? [];
    if (
      view.step &&
      prev.step &&
      view.step.index > prev.step.index &&
      laps.length > 0 &&
      (recorder.getState()?.plan?.steps.length ?? 0) > 1
    ) {
      setStepDone({ lapIndex: laps.length - 1, left: STEP_DONE_SEC });
    }
    if (view.planDone && !prev.planDone) setSheet("goalDone");
    if (prev.gps !== "lost" && view.gps === "lost") setGpsToast(true);
  }, [view]);

  useEffect(() => {
    if (!stepDone) return;
    const timer = setTimeout(() => {
      setStepDone((current) =>
        current && current.left > 1
          ? { ...current, left: current.left - 1 }
          : null,
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [stepDone]);

  useEffect(() => {
    if (!gpsToast) return;
    const timer = setTimeout(() => setGpsToast(false), GPS_TOAST_MS);
    return () => clearTimeout(timer);
  }, [gpsToast]);

  if (!snapshot || !view)
    return (
      <View style={[styles.root, { backgroundColor: theme.color.screen }]} />
    );

  const { config, meta } = snapshot;
  const units = format.units;
  const unitM = units === "imperial" ? METRES_PER_MILE : 1000;
  const fmt: Fmt = {
    units,
    locale: format.locale,
    distanceUnit: units === "imperial" ? format.labels.mi : format.labels.km,
    paceUnit: units === "imperial" ? format.labels.perMi : format.labels.perKm,
  };
  const planSteps = state?.plan?.steps ?? [];
  // A plan of one step reads like a goal: time left, or distance left with the corridor.
  const goal =
    meta.goal ?? goalOfStep(planSteps.length === 1 ? planSteps[0] : undefined);
  const multiStep = !goal && planSteps.length > 1;
  const canMap =
    mapsEnabled &&
    config.environment !== "treadmill" &&
    config.distanceMode === "gps";
  const pages: Page[] = [
    "metrics",
    ...(canMap ? (["map"] as const) : []),
    ...(multiStep ? (["steps"] as const) : []),
  ];
  const paused = view.status === "paused";
  const running = !paused && !locked;
  const typeLabels = copy.plan.creation.workoutTypes as Record<
    string,
    string | undefined
  >;
  const runTitle =
    meta.plannedTitle ??
    (meta.workoutType ? typeLabels[meta.workoutType] : null) ??
    (config.environment === "treadmill" ? t.treadmillTitle : t.freeTitle);
  const goalTitle =
    meta.goal && meta.plannedWorkoutId
      ? fillTemplate(t.card.own, { type: runTitle })
      : runTitle;

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const semibold = theme.typography.fontFamily.sans.semibold;
  const iconSmall = {
    size: 15,
    color: theme.color.mutedForeground,
    strokeWidth: 2,
  };

  const metricLabel = (key: MetricKey): string =>
    key === "splitPace" && units === "imperial"
      ? t.metricNames.splitPaceImperial
      : t.metricNames[key];
  const metricCell = (key: MetricKey, label?: string): MetricCell => {
    const icon = {
      time: <Timer {...iconSmall} />,
      distance: <Ruler {...iconSmall} />,
      pace: <Gauge {...iconSmall} />,
      splitPace: <Activity {...iconSmall} />,
      avgPace: <ChartLine {...iconSmall} />,
      elevation: <Mountain {...iconSmall} />,
      cadence: <Footprints {...iconSmall} />,
    }[key];
    // Cells are half the screen wide: the shorter name of the last km pace.
    const cellLabel =
      key === "splitPace"
        ? units === "imperial"
          ? t.cellNames.splitPaceImperial
          : t.cellNames.splitPace
        : metricLabel(key);
    const base = { key, label: label ?? cellLabel, icon };
    switch (key) {
      case "time":
        return { ...base, value: formatClock(view.movingMs) };
      case "distance":
        return {
          ...base,
          value: formatDistanceValue(view.distanceM, units, format.locale),
          unit: fmt.distanceUnit,
        };
      case "pace":
        return {
          ...base,
          value: formatPaceValue(
            paused ? null : view.currentPaceSecPerKm,
            units,
          ),
          unit: fmt.paceUnit,
        };
      case "splitPace":
        return {
          ...base,
          value: formatPaceValue(lastUnitPace(state, view, unitM), units),
          unit: fmt.paceUnit,
        };
      case "avgPace":
        return {
          ...base,
          value: formatPaceValue(view.avgPaceSecPerKm, units),
          unit: fmt.paceUnit,
        };
      case "elevation":
        return {
          ...base,
          value: String(Math.round(view.elevationGainM)),
          unit: t.metrics.metres,
        };
      case "cadence":
        return {
          ...base,
          value: view.cadence ? String(view.cadence) : "–",
          unit: t.metrics.spm,
        };
    }
  };

  // --- Status pill.
  const pausedFor = pauseDurationMs(state, Date.now());
  const status = paused
    ? {
        icon: (
          <CirclePause
            size={16}
            color={theme.color.foreground}
            strokeWidth={2}
          />
        ),
        text: fillTemplate(t.status.pausedFor, {
          time: formatClock(pausedFor),
        }),
      }
    : view.autoPaused
      ? {
          icon: (
            <CirclePause
              size={16}
              color={theme.color.foreground}
              strokeWidth={2}
            />
          ),
          text: t.status.auto,
        }
      : view.gps === "lost"
        ? {
            icon: (
              <MapPinOff
                size={16}
                color={theme.color.foreground}
                strokeWidth={2}
              />
            ),
            text: t.status.noGps,
          }
        : view.gps === "off"
          ? {
              icon: (
                <Footprints
                  size={16}
                  color={theme.color.foreground}
                  strokeWidth={2}
                />
              ),
              text: t.status.pedometer,
            }
          : view.gps === "good"
            ? {
                icon: (
                  <LocateFixed
                    size={16}
                    color={theme.color.foreground}
                    strokeWidth={2}
                  />
                ),
                text: t.status.gps,
              }
            : {
                icon: (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: theme.color.mutedForeground },
                    ]}
                  />
                ),
                text: t.status.searching,
              };

  // --- Finish.
  const finish = () => {
    if (view.distanceM < SHORT_RUN_M && view.movingMs < SHORT_RUN_MS) {
      setSheet("short");
      return;
    }
    void recorder.finish();
  };

  const topContent = insets.top + 70;
  const bottomSpace = insets.bottom + 120;

  const doneLap =
    stepDone && state?.plan
      ? (state.plan.laps[stepDone.lapIndex] ?? null)
      : null;
  const doneStep = doneLap ? (planSteps[doneLap.index] ?? null) : null;

  const metricsPage = (() => {
    if (goal?.kind === "duration") {
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={[
            styles.pageScroll,
            { paddingTop: topContent, paddingBottom: bottomSpace },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <TimeGoalCard
            view={view}
            goal={goal}
            title={goalTitle}
            goalLabel={format.minutes(Math.round((goal.durationSec ?? 0) / 60))}
            copy={copy}
            fmt={fmt}
            theme={theme}
          />
          <View style={styles.gridGap}>
            <MetricGrid
              theme={theme}
              cells={[
                metricCell("distance"),
                metricCell("pace"),
                metricCell("time"),
                metricCell("cadence"),
              ]}
            />
          </View>
        </ScrollView>
      );
    }
    if (goal?.kind === "distance") {
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={[
            styles.pageScroll,
            { paddingTop: topContent, paddingBottom: bottomSpace },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <DistanceGoalCard
            view={view}
            goal={goal}
            title={goalTitle}
            copy={copy}
            fmt={fmt}
            theme={theme}
          />
          <View style={styles.gridGap}>
            <MetricGrid
              theme={theme}
              cells={[
                metricCell("time"),
                metricCell("distance"),
                metricCell("avgPace"),
                metricCell("pace"),
              ]}
            />
          </View>
        </ScrollView>
      );
    }
    if (multiStep && (view.step || doneLap)) {
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={[
            styles.pageScroll,
            { paddingTop: topContent, paddingBottom: bottomSpace },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {doneLap && doneStep ? (
            <StepDoneCard
              lap={doneLap}
              step={doneStep}
              total={planSteps.length}
              next={planSteps[doneLap.index + 1] ?? null}
              secondsLeft={stepDone?.left ?? 0}
              copy={copy}
              fmt={fmt}
              theme={theme}
            />
          ) : (
            <PlanCard
              view={view}
              steps={planSteps}
              copy={copy}
              fmt={fmt}
              theme={theme}
              onSkip={locked ? undefined : () => recorder.nextStep()}
            />
          )}
          <View style={styles.gridGap}>
            <MetricGrid
              theme={theme}
              cells={[
                metricCell("time"),
                metricCell("distance"),
                metricCell("avgPace"),
                metricCell("pace"),
              ]}
            />
          </View>
        </ScrollView>
      );
    }
    return (
      <View
        style={[
          styles.page,
          styles.freePage,
          { width, paddingTop: topContent, paddingBottom: bottomSpace },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroLabel}>
            <Ruler
              size={17}
              color={theme.color.mutedForeground}
              strokeWidth={2}
            />
            <Text style={[styles.heroLabelText, muted]}>
              {view.onPedometer ? t.distancePedometer : t.metrics.distance}
            </Text>
          </View>
          <View style={styles.heroValueRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={[styles.heroValue, strong]}
            >
              {formatDistanceValue(view.distanceM, units, format.locale)}
            </Text>
            <Text style={[styles.heroUnit, muted]}>{fmt.distanceUnit}</Text>
          </View>
        </View>
        <MetricGrid
          theme={theme}
          cells={cells.map((key) => metricCell(key))}
          onLongPress={
            locked
              ? undefined
              : (index) => {
                  setEditingCell(index);
                  setSheet("metric");
                }
          }
        />
      </View>
    );
  })();

  const mapPage = canMap ? (
    <View style={[styles.page, styles.mapPage, { width }]}>
      <TrackMap
        theme={theme}
        lines={lines}
        markers={markers}
        mode="follow"
        centerLabel={t.centerMap}
        centerButtonStyle={{ top: undefined, bottom: bottomSpace + 100 }}
        ornamentsBottom={bottomSpace + 96}
        style={StyleSheet.absoluteFill}
      />
      <Glass
        theme={theme}
        style={[styles.mapStats, { bottom: bottomSpace + 14 }]}
      >
        {[metricCell("time"), metricCell("distance"), metricCell("pace")].map(
          (cell, index) => (
            <View
              key={cell.key}
              style={[
                styles.mapStat,
                index > 0 && {
                  borderLeftWidth: 1,
                  borderLeftColor: theme.color.chromeBorder,
                },
              ]}
            >
              <Text numberOfLines={1} style={[styles.small, muted]}>
                {cell.label}
              </Text>
              <View style={styles.mapStatValue}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.mapStatNumber, styles.shrink, strong]}
                >
                  {cell.value}
                </Text>
                {cell.unit ? (
                  <Text style={[styles.tiny, muted]}>{cell.unit}</Text>
                ) : null}
              </View>
            </View>
          ),
        )}
      </Glass>
    </View>
  ) : null;

  const stepsPage = multiStep ? (
    <View
      style={[
        styles.page,
        { width, paddingTop: topContent, paddingBottom: bottomSpace },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <StepsList
          steps={planSteps}
          laps={state?.plan?.laps ?? []}
          view={view}
          copy={copy}
          fmt={fmt}
          theme={theme}
        />
      </ScrollView>
    </View>
  ) : null;

  const pageViews: Record<Page, React.ReactNode> = {
    metrics: metricsPage,
    map: mapPage,
    steps: stepsPage,
  };

  const goalDoneTitle = goal
    ? fillTemplate(t.sheets.goalDone.title, {
        goal:
          goal.kind === "duration"
            ? format.minutes(Math.round((goal.durationSec ?? 0) / 60))
            : format.distance((goal.distanceM ?? 0) / 1000),
      })
    : t.sheets.planDone.title;
  const workLaps = (state?.plan?.laps ?? []).filter(
    (lap) => lap.kind === "work",
  );
  const workTotal = planSteps.filter((step) => step.kind === "work").length;
  const doneStats = goal
    ? [
        { label: t.metrics.time, value: formatClock(view.movingMs) },
        {
          label: t.metrics.distance,
          value: `${formatDistanceValue(view.distanceM, units, format.locale)} ${fmt.distanceUnit}`,
        },
        {
          label: t.metrics.avgPace,
          value: `${formatPaceValue(view.avgPaceSecPerKm, units)} ${fmt.paceUnit}`,
        },
      ]
    : [
        {
          label: t.metrics.distance,
          value: `${formatDistanceValue(view.distanceM, units, format.locale)} ${fmt.distanceUnit}`,
        },
        { label: t.metrics.time, value: formatClock(view.movingMs) },
        ...(workTotal > 0
          ? [
              {
                label: t.sheets.laps,
                value: fillTemplate(t.sheets.lapsValue, {
                  done: workLaps.length,
                  total: workTotal,
                }),
              },
            ]
          : []),
      ];

  const voiceSettings = meta.voice ?? {
    ...DEFAULT_VOICE_SETTINGS,
    language,
    units,
  };
  // The closing sheet keeps its content while it slides away.
  if (sheet === "short" || sheet === "goalDone") runSheetKind.current = sheet;
  const shortSheet = runSheetKind.current === "short";

  return (
    <View
      style={[styles.root, { backgroundColor: theme.color.screen }]}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w !== size.width || h !== size.height)
          setSize({ width: w, height: h });
      }}
    >
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        scrollEnabled={!locked && pages.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
      >
        {pages.map((key) => (
          <View key={key} style={{ width, height: size.height }}>
            {pageViews[key]}
          </View>
        ))}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.top, { paddingTop: insets.top + 8 }]}
      >
        <Glass theme={theme} style={styles.status}>
          {status.icon}
          <Text numberOfLines={1} style={[styles.statusText, strong]}>
            {status.text}
          </Text>
        </Glass>
        {pages.length > 1 && !locked && !paused ? (
          <View style={styles.dots}>
            {pages.map((key, index) => (
              <View
                key={key}
                accessibilityLabel={t.pages[key]}
                style={[
                  styles.pageDot,
                  { backgroundColor: theme.color.foreground },
                  index === page ? styles.pageDotOn : null,
                ]}
              />
            ))}
          </View>
        ) : null}
        {gpsToast ? (
          <Glass theme={theme} style={styles.toast}>
            <MapPinOff
              size={20}
              color={theme.color.foreground}
              strokeWidth={2}
            />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.toastTitle, strong]}>
                {t.gpsLostToast.title}
              </Text>
              <Text numberOfLines={1} style={[styles.small, muted]}>
                {t.gpsLostToast.body}
              </Text>
            </View>
          </Glass>
        ) : null}
      </View>

      {running ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.voiceSheet.title}
          onPress={() => setSheet("voice")}
          hitSlop={8}
          style={[styles.voiceButton, { top: insets.top + 5 }]}
        >
          <Glass theme={theme} interactive style={styles.voiceGlass}>
            <Volume2 size={18} color={theme.color.foreground} strokeWidth={2} />
          </Glass>
        </Pressable>
      ) : null}

      {view.autoPaused && !paused ? (
        <Text style={[styles.caption, muted, { bottom: insets.bottom + 120 }]}>
          {t.autoPauseCaption}
        </Text>
      ) : null}
      {paused && !locked ? (
        <Text style={[styles.caption, muted, { bottom: insets.bottom + 120 }]}>
          {t.holdFinishCaption}
        </Text>
      ) : null}

      <View style={[styles.controls, { bottom: insets.bottom + 16 }]}>
        {locked ? (
          <HoldButton
            accessibilityLabel={t.unlockHint}
            onHold={() => setLocked(false)}
            fillColor={withAlpha(theme.color.foreground, 0.12)}
            style={[
              styles.lockBar,
              {
                backgroundColor: theme.color.chromeFill,
                borderColor: theme.color.chromeBorder,
              },
            ]}
          >
            <Lock size={20} color={theme.color.foreground} strokeWidth={2} />
            <Text style={[styles.lockText, strong]}>{t.unlockHint}</Text>
          </HoldButton>
        ) : paused ? (
          <Glass theme={theme} style={styles.pausedBar}>
            <HoldButton
              accessibilityLabel={t.holdToFinish}
              onHold={finish}
              fillColor={withAlpha(theme.color.foreground, 0.12)}
              style={[
                styles.pausedButton,
                { backgroundColor: withAlpha(theme.color.foreground, 0.06) },
              ]}
            >
              <Text
                style={[
                  styles.buttonLabel,
                  { color: theme.color.foreground, fontFamily: semibold },
                ]}
              >
                {t.finish}
              </Text>
            </HoldButton>
            <Pressable
              accessibilityRole="button"
              onPress={() => recorder.resume()}
              style={({ pressed }) => [
                styles.pausedButton,
                { backgroundColor: theme.color.primary },
                pressed && styles.pressed,
              ]}
            >
              <Play
                size={20}
                color={theme.color.primaryForeground}
                fill={theme.color.primaryForeground}
              />
              <Text
                style={[
                  styles.buttonLabel,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: semibold,
                  },
                ]}
              >
                {t.resume}
              </Text>
            </Pressable>
          </Glass>
        ) : (
          <View style={styles.runRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.lock}
              onPress={() => setLocked(true)}
              style={({ pressed }) => [
                styles.lockButton,
                pressed && styles.pressed,
              ]}
            >
              <Glass theme={theme} interactive style={styles.lockGlass}>
                <Lock
                  size={22}
                  color={theme.color.foreground}
                  strokeWidth={2}
                />
              </Glass>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => recorder.pause()}
              style={({ pressed }) => [
                styles.pauseButton,
                { backgroundColor: theme.color.primary },
                pressed && styles.pressed,
              ]}
            >
              <Pause
                size={22}
                color={theme.color.primaryForeground}
                fill={theme.color.primaryForeground}
              />
              <Text
                style={[
                  styles.pauseText,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: semibold,
                  },
                ]}
              >
                {t.pause}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <RunSheet
        visible={sheet === "goalDone" || sheet === "short"}
        kind={shortSheet ? "short" : "done"}
        title={shortSheet ? t.sheets.short.title : goalDoneTitle}
        body={
          shortSheet
            ? t.sheets.short.body
            : goal
              ? t.sheets.goalDone.body
              : t.sheets.planDone.body
        }
        stats={
          shortSheet
            ? [
                {
                  label: t.metrics.distance,
                  value: `${formatDistanceValue(view.distanceM, units, format.locale)} ${fmt.distanceUnit}`,
                },
                { label: t.metrics.time, value: formatClock(view.movingMs) },
                {
                  label: t.metrics.pace,
                  value: formatPaceValue(view.avgPaceSecPerKm, units),
                },
              ]
            : doneStats
        }
        onFinish={() => void recorder.finish()}
        onContinue={() => {
          if (paused) recorder.resume();
        }}
        onDelete={() => {
          void recorder.discard().then(() => openTab("today"));
        }}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <MetricSheet
        visible={sheet === "metric"}
        current={cells[editingCell] ?? "time"}
        cells={cells}
        label={metricLabel}
        valueOf={(key) => {
          const cell = metricCell(key);
          return cell.unit && cell.unit !== fmt.paceUnit
            ? `${cell.value} ${cell.unit}`
            : cell.value;
        }}
        onPick={(key) => {
          const next = cells.map((item, index) =>
            index === editingCell ? key : item,
          );
          setCells(next);
          void saveCells(next);
        }}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <VoiceSheet
        visible={sheet === "voice"}
        settings={voiceSettings}
        onChange={(next) => recorder.setVoice(next)}
        onClose={() => setSheet(null)}
        units={units}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </View>
  );
}

/** Goal or plan done, or a run too short to keep. */
function RunSheet({
  visible,
  kind,
  title,
  body,
  stats,
  onFinish,
  onContinue,
  onDelete,
  onClose,
  copy,
  theme,
  themeMode,
}: {
  visible: boolean;
  kind: "done" | "short";
  title: string;
  body: string;
  stats: Array<{ label: string; value: string }>;
  onFinish: () => void;
  onContinue: () => void;
  onDelete: () => void;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const t = copy.tracker.sheets;
  const [open, setOpen] = useState(false);
  const after = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);
  const close = (then: () => void) => {
    after.current = then;
    setOpen(false);
  };
  return (
    <BottomSheet
      title={title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        const then = after.current ?? (kind === "short" ? onContinue : null);
        after.current = null;
        onClose();
        then?.();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
      >
        <SheetBlock theme={theme}>
          <SheetBadge theme={theme}>
            {kind === "short" ? (
              <Clock3
                size={26}
                color={theme.color.foreground}
                strokeWidth={1.9}
              />
            ) : (
              <Check
                size={26}
                color={theme.color.foreground}
                strokeWidth={1.9}
              />
            )}
          </SheetBadge>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetSubtitle text={body} theme={theme} />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            {stats.map((stat, index) => (
              <SheetListRow
                key={stat.label}
                theme={theme}
                divided={index > 0}
                title={stat.label}
                value={stat.value}
              />
            ))}
          </SheetList>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={styles.sheetButtons}>
            {kind === "done" ? (
              <>
                <SheetButton
                  label={t.finishRun}
                  onPress={() => close(onFinish)}
                  theme={theme}
                  themeMode={themeMode}
                />
                <SheetButton
                  label={t.continueRun}
                  variant="secondary"
                  onPress={() => close(() => undefined)}
                  theme={theme}
                  themeMode={themeMode}
                />
              </>
            ) : (
              <>
                <SheetButton
                  label={t.continueRun}
                  onPress={() => close(onContinue)}
                  theme={theme}
                  themeMode={themeMode}
                />
                <SheetButton
                  label={t.deleteRun}
                  variant="destructive"
                  onPress={() => close(onDelete)}
                  theme={theme}
                  themeMode={themeMode}
                />
              </>
            )}
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

/** Which value a cell of the free run shows. */
function MetricSheet({
  visible,
  current,
  cells,
  label,
  valueOf,
  onPick,
  onClose,
  copy,
  theme,
  themeMode,
}: {
  visible: boolean;
  current: MetricKey;
  cells: MetricKey[];
  label: (key: MetricKey) => string;
  valueOf: (key: MetricKey) => string;
  onPick: (key: MetricKey) => void;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const t = copy.tracker.metricPicker;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);
  return (
    <BottomSheet
      title={t.title}
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
        contentContainerStyle={styles.metricContent}
      >
        <SheetBlock theme={theme}>
          <SheetSubtitle
            text={fillTemplate(t.instead, { metric: label(current) })}
            theme={theme}
          />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            {METRIC_KEYS.filter((key) => key !== "distance").map(
              (key, index) => {
                const shown = cells.includes(key) && key !== current;
                return (
                  <SheetListRow
                    key={key}
                    theme={theme}
                    divided={index > 0}
                    title={label(key)}
                    value={shown ? t.onScreen : valueOf(key)}
                    checked={key === current}
                    disabled={shown}
                    onPress={() => {
                      onPick(key);
                      setOpen(false);
                    }}
                  />
                );
              },
            )}
          </SheetList>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <Text
            style={[
              styles.hint,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {t.hint}
          </Text>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 16 },
  // Card pages scroll on short screens instead of going under the controls.
  pageScroll: { paddingHorizontal: 16 },
  freePage: { justifyContent: "center", gap: 40 },
  mapPage: { paddingHorizontal: 0 },
  gridGap: { marginTop: 16 },
  hero: { alignItems: "center" },
  heroLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroLabelText: { fontSize: 15, lineHeight: 20 },
  heroValueRow: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  heroValue: {
    flexShrink: 1,
    fontSize: 108,
    lineHeight: 112,
    letterSpacing: -5,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: { fontSize: 22, lineHeight: 28 },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
  },
  status: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    overflow: "hidden",
  },
  statusText: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dots: { marginTop: 8, flexDirection: "row", gap: 6 },
  pageDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.25 },
  pageDotOn: { width: 18, opacity: 1 },
  toast: {
    marginTop: 12,
    alignSelf: "stretch",
    marginHorizontal: 16,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  toastTitle: { fontSize: 15, lineHeight: 20 },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 12, lineHeight: 16 },
  voiceButton: { position: "absolute", right: 16, width: 40, height: 40 },
  voiceGlass: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  controls: { position: "absolute", left: 16, right: 16 },
  runRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockButton: { width: 68, height: 68 },
  lockGlass: {
    flex: 1,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pauseButton: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pauseText: { fontSize: 18, lineHeight: 22 },
  pausedBar: {
    flexDirection: "row",
    gap: 8,
    padding: 6,
    borderRadius: 40,
    overflow: "hidden",
  },
  pausedButton: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: { fontSize: 17, lineHeight: 22 },
  lockBar: {
    height: 72,
    borderRadius: 36,
    borderWidth: 0.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  lockText: { fontSize: 16, lineHeight: 22 },
  mapStats: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 84,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  mapStat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
  },
  mapStatValue: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  mapStatNumber: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  pressed: { opacity: 0.85 },
  sheetScroll: { width: "100%" },
  sheetContent: { gap: 16, paddingTop: 72, paddingBottom: 32 },
  metricContent: { gap: 14, paddingTop: 72, paddingBottom: 32 },
  sheetButtons: { gap: 8, marginTop: 4 },
  hint: { paddingHorizontal: 16, fontSize: 13, lineHeight: 18 },
});

function goalOfStep(step: ExecutionStep | undefined): RunGoal | null {
  if (!step) return null;
  if (step.durationSec !== null)
    return {
      kind: "duration",
      durationSec: step.durationSec,
      distanceM: null,
      timeLimitSec: null,
    };
  if (step.distanceM !== null)
    return {
      kind: "distance",
      durationSec: null,
      distanceM: step.distanceM,
      timeLimitSec: null,
    };
  return null;
}
