import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check,
  Footprints,
  Heart,
  Ruler as RulerIcon,
  Share2,
  Trash2,
} from "lucide-react-native";

import type {
  RecordedLap,
  RecordedSplit,
  WorkoutType,
} from "@trefix/api-client";
import { withAlpha, type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Ruler } from "@trefix/ui-native";

import appConfig from "../../../../app.json";
import {
  fillTemplate,
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { workoutGoal } from "../../../shared/lib/workout-target";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { SectionTitle } from "../../../shared/ui/list-card";
import {
  SheetBadge,
  SheetList,
  SheetListRow,
  SheetSubtitle,
} from "../../../shared/ui/sheet-list";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import {
  HeaderBackButton,
  HeaderOptionsButton,
  HeaderTitle,
} from "../../main/components/header";
import { IntensityScale } from "../../main/components/intensity-scale";
import { SectionLayout } from "../../main/components/section-layout";
import { StatusBox } from "../../main/components/today/day-event-cards";
import { useHeaderOptions } from "../../main/context/header-context";
import { workoutIntensity } from "../../main/lib/workout-intensity";
import { openTab, replaceSubScreen } from "../../main/main-routes";
import { useWorkout } from "../../plans/hooks/use-workout";
import { todayIso, toIsoDate } from "../../plans/lib/plan-dates";
import { useAthleteProfile } from "../../profile/hooks/use-athlete-profile";
import { useGear } from "../../profile/hooks/use-gear";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { buildRunExport, exportRun } from "../health-export";
import { buildSplits } from "../engine/summary";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { useRecorder, useUploadQueue } from "../hooks";
import { TrackMap } from "../map/track-map";
import { useTrackLines } from "../map/use-track-lines";
import { formatStepSize } from "../plan-format";
import { recorder } from "../recorder";
import { usePlannedWorkout } from "../setup-hooks";
import { useSummaryHealth } from "../use-summary-health";

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
const HEADER_OFFSET = 78;
type SummarySheet = "distance" | "type" | "gear" | "more" | "delete" | null;

/**
 * After the finish: the open top block with the run, its results, plan and
 * splits, how it felt, details and saving. "Save" opens the workout with
 * Tref's review.
 */
export function TrackerSummaryScreen({
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const t = copy.tracker;
  const ts = t.summary;
  const insets = useSafeAreaInsets();
  const snapshot = useRecorder();
  const state = recorder.getState();
  const format = useUnitFormat(copy, language);
  const units = format.units;
  const upload = useUploadQueue(copy);
  const { showToast } = useToast();
  const athlete = useAthleteProfile();
  const shoes = useGear("active");
  const health = useSummaryHealth(
    state?.startedAt ?? null,
    state ? (state.endedAt ?? state.clock) : null,
  );
  const store =
    health.source?.provider === "apple_health"
      ? copy.profile.integrations.health.appleTitle
      : copy.profile.integrations.health.connectTitle;

  const meta = snapshot?.meta ?? null;
  const measuredM = Math.round(state?.distanceM ?? 0);
  const treadmill = state?.config.environment === "treadmill";
  const byPedometer = state
    ? treadmill ||
      state.config.distanceMode === "time" ||
      state.gpsDistanceM <= 0
    : false;
  const [distanceM, setDistanceM] = useState(measuredM);
  const [workoutType, setWorkoutType] = useState<Exclude<
    WorkoutType,
    "rest"
  > | null>(meta?.workoutType ?? null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [gearId, setGearId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<SummarySheet>(null);

  // A free run on a day with an unfinished workout closes it, unless turned off.
  const todays = usePlannedWorkout(null);
  const linkCandidate =
    meta && !meta.plannedWorkoutId && todays ? todays : null;
  const [link, setLink] = useState(true);
  const plannedWorkout =
    useWorkout(meta?.plannedWorkoutId ?? null).data ?? null;

  const track = recorder.getTrack();
  const { lines, markers } = useTrackLines(
    track,
    units,
    snapshot?.trackSize ?? 0,
  );
  const splits = useMemo(
    () =>
      state ? buildSplits(state.timeline, state.distanceM, distanceM) : [],
    [distanceM, state],
  );

  const defaultShoe = useMemo(() => {
    const list = (shoes.data ?? []).filter((item) => item.type === "shoes");
    const type = workoutType ?? "easy";
    return (
      list.find((item) =>
        (item.defaultWorkoutTypes as string[]).includes(type),
      ) ?? null
    );
  }, [shoes.data, workoutType]);

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => openTab("today")}
        />
      ),
      centerContent: <HeaderTitle theme={theme}>{t.summaryTitle}</HeaderTitle>,
      rightAction: (
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setSheet("more")}
        />
      ),
      variant: "default",
      bottomContent: null,
      tone: "surface",
    },
    [theme, themeMode, t.summaryTitle],
  );

  if (!state || !snapshot || !meta) return null;

  const distanceUnit =
    units === "imperial" ? format.labels.mi : format.labels.km;
  const paceUnit =
    units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const movingSec = Math.max(1, Math.round(state.movingMs / 1000));
  const avgPace = distanceM > 0 ? (movingSec / distanceM) * 1000 : null;
  const laps = state.plan?.laps ?? [];
  const planSteps = state.plan?.steps ?? [];
  const goal = meta.goal ?? null;
  const typeLabels = copy.plan.creation.workoutTypes as Record<
    string,
    string | undefined
  >;
  const type = workoutType ?? meta.workoutType ?? null;
  const level = type ? workoutIntensity(type) : 2;
  const title =
    meta.plannedTitle ??
    (type ? typeLabels[type] : null) ??
    (treadmill ? t.treadmillTitle : t.freeTitle);
  const hasElevation =
    state.gpsDistanceM > 0 || state.elevation.source === "baro";
  const cadence =
    state.steps > 0 && state.movingMs >= 60_000
      ? Math.round(state.steps / (state.movingMs / 60_000))
      : null;
  const distanceText = `${formatDistanceValue(distanceM, units, format.locale)} ${distanceUnit}`;
  const goalText = goal
    ? goal.kind === "duration"
      ? format.minutes(Math.round((goal.durationSec ?? 0) / 60))
      : format.distance((goal.distanceM ?? 0) / 1000)
    : null;
  const goalPercent = goal
    ? Math.round(
        Math.min(
          1,
          goal.kind === "duration"
            ? state.movingMs / 1000 / (goal.durationSec || 1)
            : distanceM / (goal.distanceM || 1),
        ) * 100,
      )
    : null;

  const started = new Date(state.startedAt);
  const time = `${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
  const day = toIsoDate(started);
  const date =
    day === todayIso()
      ? fillTemplate(ts.todayAt, { time })
      : `${formatDayMonth(day, language)}, ${time}`;
  const kicker = !meta.plannedWorkoutId
    ? fillTemplate(treadmill ? ts.kicker.treadmill : ts.kicker.free, { date })
    : plannedWorkout?.planId && plannedWorkout.weekNumber
      ? fillTemplate(ts.kicker.week, {
          date,
          number: plannedWorkout.weekNumber,
        })
      : fillTemplate(ts.kicker.own, { date });
  const isPlanWorkout = Boolean(plannedWorkout?.planId);
  const meta2 = [
    type ? typeLabels[type] : ts.noPlan,
    copy.today.workout.intensity[level],
    goalText ? fillTemplate(ts.goalMeta, { goal: goalText }) : null,
    byPedometer && !treadmill ? ts.noGpsMeta : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tiles = [
    {
      label: ts.tiles.pace,
      value: formatPaceValue(avgPace, units),
      unit: paceUnit,
    },
    health.heartRate
      ? {
          label: ts.tiles.avgHeartRate,
          value: String(health.heartRate.avg),
          unit: t.metrics.bpm,
        }
      : null,
    hasElevation
      ? {
          label: ts.tiles.elevation,
          value: String(Math.round(state.elevation.gainM)),
          unit: t.metrics.metres,
        }
      : null,
    cadence
      ? { label: ts.tiles.cadence, value: String(cadence), unit: t.metrics.spm }
      : null,
    health.heartRate
      ? {
          label: ts.tiles.maxHeartRate,
          value: String(health.heartRate.max),
          unit: t.metrics.bpm,
        }
      : null,
  ]
    .filter(
      (tile): tile is { label: string; value: string; unit: string } =>
        tile !== null,
    )
    .slice(0, 4);

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
      const linked = linkCandidate && link ? linkCandidate.id : null;
      const sessionId = await recorder.save(
        {
          distanceM: distanceM !== measuredM ? distanceM : null,
          workoutType,
          plannedWorkoutId: meta.plannedWorkoutId ?? linked,
          linkPlanned: linkCandidate ? link : undefined,
          heartRate: health.heartRate,
          feeling,
          rpe,
          notes,
          gearId: gearId ?? undefined,
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
      if (run && health.source) {
        const outcome = await exportRun(health.source, run);
        if (outcome === "denied")
          showToast(fillTemplate(t.healthDenied, { store }));
        else if (outcome === "failed")
          showToast(fillTemplate(t.healthFailed, { store }));
      }
      if (mine?.status === "uploaded") {
        replaceSubScreen({
          kind: "workout-details",
          workoutId: mine.result.workoutId,
        });
        return;
      }
      showToast(mine?.status === "retry" ? t.savedOffline : t.saved);
      openTab("today");
    } finally {
      setSaving(false);
    }
  };

  const share = () => {
    void Share.share({
      message: fillTemplate(ts.shareText, {
        title,
        distance: distanceText,
        time: formatClock(state.movingMs),
        pace: `${formatPaceValue(avgPace, units)} ${paceUnit}`,
      }),
    }).catch(() => undefined);
  };

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
  const selectedShoe =
    (shoes.data ?? []).find((item) => item.id === gearId) ?? defaultShoe;
  const shoeName = (item: {
    brand: string;
    model: string;
    nickname: string | null;
  }) => item.nickname?.trim() || `${item.brand} ${item.model}`.trim();

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
          <IntensityScale theme={theme} level={level} size="hero" />
          <View style={styles.kickerRow}>
            <Text
              numberOfLines={1}
              style={[styles.kicker, muted, { fontFamily: strong.fontFamily }]}
            >
              {kicker}
            </Text>
            <StatusBox
              theme={theme}
              status="completed"
              label={copy.today.workout.statuses.completed}
            />
          </View>
          <Text style={[styles.title, strong]}>{title}</Text>
          <View style={styles.volume}>
            <Text numberOfLines={1} style={[styles.volumeValue, strong]}>
              {distanceText}
            </Text>
            <Text numberOfLines={1} style={[styles.volumeSub, muted]}>
              {formatClock(state.movingMs)}
            </Text>
          </View>
          <Text style={[styles.meta, muted]}>{meta2}</Text>
        </View>

        {linkCandidate ? (
          <View style={styles.section}>
            <SectionTitle text={ts.link.section} theme={theme} />
            <View
              style={[
                styles.card,
                styles.linkRow,
                { backgroundColor: theme.color.card },
              ]}
            >
              <StatusBox
                theme={theme}
                status="planned"
                label={copy.today.workout.statuses.planned}
              />
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[styles.rowTitle, strong]}>
                  {fillTemplate(ts.link.title, {
                    title:
                      (
                        linkCandidate.target as Record<string, unknown> | null
                      )?.title?.toString() ||
                      typeLabels[linkCandidate.type] ||
                      linkCandidate.type,
                  })}
                </Text>
                <Text numberOfLines={1} style={[styles.small, muted]}>
                  {linkGoalText(
                    linkCandidate,
                    state.movingMs,
                    distanceM,
                    format,
                    ts,
                  )}
                </Text>
              </View>
              <Switch
                value={link}
                onValueChange={setLink}
                theme={theme}
                accessibilityLabel={ts.link.section}
              />
            </View>
            <Text style={[styles.hint, muted]}>{ts.link.hint}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle text={ts.result} theme={theme} />
          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View
                key={tile.label}
                style={[styles.tile, { backgroundColor: theme.color.card }]}
              >
                <Text numberOfLines={1} style={[styles.small, muted]}>
                  {tile.label}
                </Text>
                <View style={styles.tileValueRow}>
                  <Text numberOfLines={1} style={[styles.tileValue, strong]}>
                    {tile.value}
                  </Text>
                  <Text numberOfLines={1} style={[styles.small, muted]}>
                    {tile.unit}
                  </Text>
                </View>
              </View>
            ))}
          </View>
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
        </View>

        {laps.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t.laps}
              note={
                goal
                  ? goalPercent !== null && goalPercent >= 100
                    ? ts.goalDone
                    : fillTemplate(ts.goalPart, { percent: goalPercent ?? 0 })
                  : lapsNote(laps, ts)
              }
              theme={theme}
            />
            <View style={[styles.card, { backgroundColor: theme.color.card }]}>
              {laps.map((lap, index) => (
                <LapRow
                  key={`${lap.index}-${index}`}
                  lap={lap}
                  index={index}
                  title={goal ? title : lapTitle(lap, planSteps, t)}
                  goalText={goal ? goalText : null}
                  copy={copy}
                  units={units}
                  theme={theme}
                />
              ))}
            </View>
          </View>
        ) : null}

        {splits.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t.splits}
              note={splitNote(splits, byPedometer, units, ts, distanceUnit)}
              theme={theme}
            />
            <View style={[styles.card, { backgroundColor: theme.color.card }]}>
              <View style={[styles.splitRow, styles.splitHead]}>
                <Text style={[styles.splitKm, styles.tiny, muted]}>
                  {t.splitKm}
                </Text>
                <View style={styles.flex} />
                <Text style={[styles.splitPace, styles.tiny, muted]}>
                  {t.splitPace}
                </Text>
                <Text style={[styles.splitEl, styles.tiny, muted]}>
                  {t.splitElevation}
                </Text>
              </View>
              {splits.map((split) => (
                <SplitRow
                  key={split.km}
                  split={split}
                  splits={splits}
                  showElevation={hasElevation}
                  units={units}
                  theme={theme}
                  locale={format.locale}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle text={ts.how} theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.color.card }]}>
            <View style={styles.how}>
              <View style={styles.howHead}>
                <Text style={[styles.rowTitle, strong]}>{t.feeling}</Text>
                <Text style={[styles.rowValue, muted]}>
                  {feeling ? t.feelings[feeling - 1] : ""}
                </Text>
              </View>
              <Circles
                count={5}
                value={feeling}
                onChange={setFeeling}
                size={38}
                labels={t.feelings}
                theme={theme}
              />
            </View>
            <View
              style={[
                styles.how,
                styles.divided,
                { borderTopColor: theme.color.screen },
              ]}
            >
              <View style={styles.howHead}>
                <Text style={[styles.rowTitle, strong]}>{t.rpe}</Text>
                <Text style={[styles.rowValue, muted]}>
                  {rpe ? `${rpe} · ${ts.rpeLabels[rpe - 1]}` : ""}
                </Text>
              </View>
              <Circles
                count={10}
                value={rpe}
                onChange={setRpe}
                size={28}
                theme={theme}
              />
            </View>
            <View
              style={[
                styles.how,
                styles.divided,
                { borderTopColor: theme.color.screen },
              ]}
            >
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={`${t.notes}: ${t.notesPlaceholder.toLowerCase()}`}
                placeholderTextColor={theme.color.mutedForeground}
                multiline
                maxLength={2000}
                style={[
                  styles.notes,
                  {
                    color: theme.color.foreground,
                    fontFamily: muted.fontFamily,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle text={ts.data} theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.color.card }]}>
            <SheetListRow
              theme={theme}
              title={ts.type}
              value={
                meta.plannedWorkoutId && type
                  ? fillTemplate(isPlanWorkout ? ts.typePlan : ts.typeOwn, {
                      type: typeLabels[type] ?? type,
                    })
                  : type
                    ? (typeLabels[type] ?? type)
                    : ts.typeFree
              }
              chevron={!meta.plannedWorkoutId}
              onPress={
                meta.plannedWorkoutId ? undefined : () => setSheet("type")
              }
            />
            <View
              style={[styles.divided, { borderTopColor: theme.color.screen }]}
            >
              <SheetListRow
                theme={theme}
                icon={<RulerIcon {...iconProps} />}
                title={t.metrics.distance}
                trailing={
                  <View style={styles.distanceValue}>
                    <Text numberOfLines={1} style={[styles.rowValue, muted]}>
                      {distanceText}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tiny, muted]}>
                      {distanceM !== measuredM
                        ? ts.distanceSource.edited
                        : byPedometer
                          ? treadmill
                            ? ts.distanceSource.treadmill
                            : ts.distanceSource.pedometer
                          : ts.distanceSource.gps}
                    </Text>
                  </View>
                }
                chevron
                onPress={() => setSheet("distance")}
              />
            </View>
            {(shoes.data ?? []).some((item) => item.type === "shoes") ? (
              <View
                style={[styles.divided, { borderTopColor: theme.color.screen }]}
              >
                <SheetListRow
                  theme={theme}
                  icon={<Footprints {...iconProps} />}
                  title={ts.shoes}
                  value={selectedShoe ? shoeName(selectedShoe) : ""}
                  chevron
                  onPress={() => setSheet("gear")}
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle text={ts.saving} theme={theme} />
          {health.source ? (
            <View
              style={[
                styles.card,
                styles.linkRow,
                { backgroundColor: theme.color.card },
              ]}
            >
              <Heart {...iconProps} />
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[styles.rowTitle, strong]}>
                  {fillTemplate(t.healthExport, { store })}
                </Text>
                <Text numberOfLines={1} style={[styles.small, muted]}>
                  {track.length >= 2
                    ? health.heartRate
                      ? ts.healthNote.routeHr
                      : ts.healthNote.route
                    : health.heartRate
                      ? ts.healthNote.hr
                      : ts.healthNote.plain}
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
          <Text style={[styles.hint, muted]}>{ts.hint}</Text>
        </View>
      </SectionLayout>

      <LinearGradient
        pointerEvents="box-none"
        colors={[
          withAlpha(theme.color.screen, 0),
          theme.color.screen,
          theme.color.screen,
        ]}
        locations={[0, 0.4, 1]}
        style={[styles.foot, { paddingBottom: insets.bottom + 8 }]}
      >
        <SheetButton
          label={t.save}
          onPress={() => void save()}
          pending={saving}
          theme={theme}
          themeMode={themeMode}
          style={styles.saveButton}
        />
      </LinearGradient>

      <DistanceSheet
        visible={sheet === "distance"}
        measuredM={measuredM}
        valueM={distanceM}
        treadmill={treadmill}
        units={units}
        locale={format.locale}
        distanceUnit={distanceUnit}
        onSave={setDistanceM}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <OptionsSheet
        visible={sheet === "type"}
        title={ts.type}
        options={[
          { key: "", label: ts.typeFree },
          ...WORKOUT_TYPES.map((key) => ({
            key,
            label: typeLabels[key] ?? key,
          })),
        ]}
        selected={workoutType ?? ""}
        onSelect={(key) =>
          setWorkoutType(key ? (key as Exclude<WorkoutType, "rest">) : null)
        }
        onClose={() => setSheet(null)}
        theme={theme}
        themeMode={themeMode}
      />

      <OptionsSheet
        visible={sheet === "gear"}
        title={ts.shoes}
        options={(shoes.data ?? [])
          .filter((item) => item.type === "shoes")
          .map((item) => ({ key: item.id, label: shoeName(item) }))}
        selected={selectedShoe?.id ?? ""}
        onSelect={(key) => setGearId(key || null)}
        onClose={() => setSheet(null)}
        theme={theme}
        themeMode={themeMode}
      />

      <MoreSheet
        visible={sheet === "more" || sheet === "delete"}
        mode={sheet === "delete" ? "delete" : "more"}
        title={title}
        onShare={share}
        onAskDelete={() => setSheet("delete")}
        onDelete={() => {
          void recorder.discard().then(() => openTab("today"));
        }}
        onClose={() =>
          setSheet((current) =>
            current === "delete" || current === "more" ? null : current,
          )
        }
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </View>
  );
}

function linkGoalText(
  workout: { target: unknown; durationMinutes: number; distanceKm: number },
  movingMs: number,
  distanceM: number,
  format: ReturnType<typeof useUnitFormat>,
  ts: MainCopy["tracker"]["summary"],
): string {
  const own = workoutGoal(workout.target);
  if (own?.goal === "duration" && workout.durationMinutes > 0) {
    const percent = Math.min(
      100,
      Math.round((movingMs / 60_000 / workout.durationMinutes) * 100),
    );
    return `${fillTemplate(ts.goalMeta, { goal: format.minutes(workout.durationMinutes) })} · ${fillTemplate(ts.goalPart, { percent })}`;
  }
  if (own?.goal === "distance" && workout.distanceKm > 0) {
    const percent = Math.min(
      100,
      Math.round((distanceM / 1000 / workout.distanceKm) * 100),
    );
    return `${fillTemplate(ts.goalMeta, { goal: format.distance(workout.distanceKm) })} · ${fillTemplate(ts.goalPart, { percent })}`;
  }
  return [
    workout.distanceKm > 0 ? format.distance(workout.distanceKm) : null,
    workout.durationMinutes > 0
      ? format.minutes(Math.round(workout.durationMinutes))
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function lapsNote(
  laps: RecordedLap[],
  ts: MainCopy["tracker"]["summary"],
): string | null {
  const targeted = laps.filter(
    (lap) => lap.inTarget !== null && lap.inTarget !== undefined,
  );
  if (targeted.length === 0) return null;
  return fillTemplate(ts.planNote, {
    done: targeted.filter((lap) => lap.inTarget).length,
    total: targeted.length,
  });
}

function lapTitle(
  lap: RecordedLap,
  steps: Array<{
    index: number;
    kind: string;
    repetition: { index: number; total: number } | null;
  }>,
  t: MainCopy["tracker"],
): string {
  const step = steps.find((item) => item.index === lap.index);
  const kind = t.stepKinds[lap.kind as keyof typeof t.stepKinds] ?? lap.kind;
  return step?.repetition && lap.kind === "work"
    ? `${kind} ${step.repetition.index}`
    : kind;
}

function splitNote(
  splits: RecordedSplit[],
  byPedometer: boolean,
  units: "metric" | "imperial",
  ts: MainCopy["tracker"]["summary"],
  unit: string,
): string | null {
  if (byPedometer) return ts.splitNote.pedometer;
  const full = splits.filter((split) => !split.partial);
  if (full.length < 2) return null;
  const paces = full.map((split) => split.paceSecPerKm);
  const first = paces[0]!;
  const last = paces[paces.length - 1]!;
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  if (first - last >= 5)
    return fillTemplate(ts.splitNote.negative, {
      from: formatPaceValue(first, units),
      to: formatPaceValue(last, units),
    });
  if (max - min <= 15)
    return fillTemplate(ts.splitNote.even, {
      min: formatPaceValue(min, units),
      max: formatPaceValue(max, units),
    });
  const fastest = full.find((split) => split.paceSecPerKm === min)!;
  return fillTemplate(ts.splitNote.fastest, {
    km: fastest.km,
    unit,
    pace: formatPaceValue(min, units),
  });
}

function SectionHeader({
  title,
  note,
  theme,
}: {
  title: string;
  note: string | null;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text
        accessibilityRole="header"
        style={[
          styles.sectionTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {title}
      </Text>
      {note ? (
        <Text
          numberOfLines={1}
          style={[
            styles.small,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function LapRow({
  lap,
  index,
  title,
  goalText,
  copy,
  units,
  theme,
}: {
  lap: RecordedLap;
  index: number;
  title: string;
  goalText: string | null;
  copy: MainCopy;
  units: "metric" | "imperial";
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  const ts = t.summary;
  const planned = formatStepSize(
    { durationSec: lap.plannedSec ?? null, distanceM: lap.plannedM ?? null },
    t,
  );
  const actual =
    lap.plannedM != null
      ? `${formatStepSize({ durationSec: null, distanceM: lap.actualM }, t)} · ${formatClock(lap.actualSec * 1000)}`
      : formatClock(lap.actualSec * 1000);
  const detail = goalText
    ? `${actual} · ${fillTemplate(ts.lapGoal, { value: goalText })}`
    : planned && lap.plannedM == null
      ? `${actual} · ${fillTemplate(ts.lapPlan, { value: planned })}`
      : actual;
  const delta = goalText
    ? ts.lapDone
    : lap.inTarget === true
      ? t.card.inCorridor
      : "";
  return (
    <View
      style={[
        styles.lapRow,
        index > 0 && [styles.divided, { borderTopColor: theme.color.screen }],
      ]}
    >
      <View
        style={[
          styles.lapBox,
          lap.inTarget === false
            ? { borderWidth: 1.5, borderColor: theme.color.controlBorder }
            : { backgroundColor: theme.color.primary },
        ]}
      >
        {lap.inTarget === false ? null : (
          <Check
            size={16}
            strokeWidth={2.6}
            color={theme.color.primaryForeground}
          />
        )}
      </View>
      <View style={styles.flex}>
        <Text
          numberOfLines={1}
          style={[
            styles.small,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {detail}
        </Text>
      </View>
      <View style={styles.lapValue}>
        <Text
          style={[
            styles.rowTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {formatPaceValue(lap.avgPaceSecPerKm ?? null, units)}
        </Text>
        {delta ? (
          <Text
            style={[
              styles.small,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {delta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SplitRow({
  split,
  splits,
  showElevation,
  units,
  theme,
  locale,
}: {
  split: RecordedSplit;
  splits: RecordedSplit[];
  showElevation: boolean;
  units: "metric" | "imperial";
  theme: ThemeTokens;
  locale: string;
}) {
  const paces = splits.map((item) => item.paceSecPerKm);
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  const width =
    35 + 65 * (max === min ? 1 : (max - split.paceSecPerKm) / (max - min));
  const label = split.partial
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        Math.max(0, split.durationSec / split.paceSecPerKm),
      )
    : String(split.km);
  return (
    <View
      style={[
        styles.splitRow,
        styles.divided,
        { borderTopColor: theme.color.screen },
      ]}
    >
      <Text
        style={[
          styles.splitKm,
          styles.splitText,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {label}
      </Text>
      <View style={styles.flex}>
        <View
          style={[
            styles.splitBar,
            {
              width: `${width}%`,
              backgroundColor:
                split.paceSecPerKm === min
                  ? theme.color.intensity3
                  : theme.color.intensity1,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.splitPace,
          styles.splitText,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {formatPaceValue(split.paceSecPerKm, units)}
      </Text>
      <Text
        style={[
          styles.splitEl,
          styles.splitText,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {showElevation && split.elevationGainM != null
          ? `+${split.elevationGainM}`
          : "–"}
      </Text>
    </View>
  );
}

function Circles({
  count,
  value,
  onChange,
  size,
  labels,
  theme,
}: {
  count: number;
  value: number | null;
  onChange: (value: number | null) => void;
  size: number;
  labels?: string[];
  theme: ThemeTokens;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.circles}>
      {Array.from({ length: count }, (_, index) => index + 1).map((item) => {
        const on = value === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={labels?.[item - 1] ?? String(item)}
            onPress={() => onChange(on ? null : item)}
            style={[
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? theme.color.primary : theme.color.screen,
              },
            ]}
          >
            <Text
              style={{
                fontSize: size > 30 ? 14 : 12,
                lineHeight: 18,
                color: on
                  ? theme.color.primaryForeground
                  : theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              }}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Distance by the pedometer can be corrected: the treadmill console or a known route. */
function DistanceSheet({
  visible,
  measuredM,
  valueM,
  treadmill,
  units,
  locale,
  distanceUnit,
  onSave,
  onClose,
  copy,
  theme,
  themeMode,
}: {
  visible: boolean;
  measuredM: number;
  valueM: number;
  treadmill: boolean;
  units: "metric" | "imperial";
  locale: string;
  distanceUnit: string;
  onSave: (metres: number) => void;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const ts = copy.tracker.summary;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(valueM);
  useEffect(() => {
    if (!visible) return;
    setDraft(valueM);
    setOpen(true);
  }, [valueM, visible]);
  const measured = `${formatDistanceValue(measuredM, units, locale)} ${distanceUnit}`;
  return (
    <BottomSheet
      title={ts.distanceSheet.title}
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
      >
        <SheetBlock theme={theme}>
          <SheetSubtitle
            text={fillTemplate(
              treadmill
                ? ts.distanceSheet.treadmillBody
                : ts.distanceSheet.body,
              {
                distance: measured,
              },
            )}
            theme={theme}
          />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <Ruler
            value={Math.round(kmToDisplay(draft / 1000, units) * 100) / 100}
            onChange={(value) =>
              setDraft(
                Math.max(0, Math.round(displayToKm(value, units) * 1000)),
              )
            }
            min={0}
            max={units === "imperial" ? 62 : 100}
            step={0.01}
            majorEvery={0.1}
            labelEvery={0.5}
            unit={distanceUnit}
            accessibilityLabel={ts.distanceSheet.title}
            theme={theme}
            themeMode={themeMode}
          />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={styles.sheetButtons}>
            <SheetButton
              label={copy.tracker.done}
              onPress={() => {
                onSave(draft);
                setOpen(false);
              }}
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={fillTemplate(ts.distanceSheet.keep, {
                distance: measured,
              })}
              variant="secondary"
              onPress={() => {
                onSave(measuredM);
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

/** A radio list that closes on a pick. */
function OptionsSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  theme,
  themeMode,
}: {
  visible: boolean;
  title: string;
  options: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);
  return (
    <BottomSheet
      title={title}
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
      >
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            {options.map((option, index) => (
              <SheetListRow
                key={option.key || "none"}
                theme={theme}
                divided={index > 0}
                title={option.label}
                checked={option.key === selected}
                onPress={() => {
                  onSelect(option.key);
                  setOpen(false);
                }}
              />
            ))}
          </SheetList>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

/** "⋯": share or delete; deleting asks once more. */
function MoreSheet({
  visible,
  mode,
  title,
  onShare,
  onAskDelete,
  onDelete,
  onClose,
  copy,
  theme,
  themeMode,
}: {
  visible: boolean;
  mode: "more" | "delete";
  title: string;
  onShare: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const ts = copy.tracker.summary;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<"more" | "delete">("more");
  const [next, setNext] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!visible) return;
    setShown(mode);
    setOpen(true);
  }, [mode, visible]);
  const closeThen = (then: () => void) => {
    setNext(() => then);
    setOpen(false);
  };
  const iconProps = { size: 20, strokeWidth: 1.9 };
  return (
    <BottomSheet
      title={shown === "delete" ? ts.deleteSheet.title : title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        const then = next;
        setNext(null);
        if (then) then();
        else onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
      >
        {shown === "delete" ? (
          <>
            <SheetBlock theme={theme}>
              <SheetBadge theme={theme} tone="danger">
                <Trash2
                  size={26}
                  color={theme.color.danger}
                  strokeWidth={1.9}
                />
              </SheetBadge>
            </SheetBlock>
            <SheetBlock theme={theme}>
              <SheetSubtitle text={ts.deleteSheet.body} theme={theme} />
            </SheetBlock>
            <SheetBlock theme={theme}>
              <View style={styles.sheetButtons}>
                <SheetButton
                  label={ts.deleteSheet.confirm}
                  variant="destructive"
                  onPress={() => closeThen(onDelete)}
                  theme={theme}
                  themeMode={themeMode}
                />
                <SheetButton
                  label={copy.tracker.cancel}
                  variant="secondary"
                  onPress={() => closeThen(onClose)}
                  theme={theme}
                  themeMode={themeMode}
                />
              </View>
            </SheetBlock>
          </>
        ) : (
          <>
            <SheetBlock theme={theme}>
              <SheetList theme={theme}>
                <SheetListRow
                  theme={theme}
                  icon={
                    <Share2 {...iconProps} color={theme.color.foreground} />
                  }
                  title={ts.more.share}
                  onPress={() =>
                    closeThen(() => {
                      onClose();
                      onShare();
                    })
                  }
                />
              </SheetList>
            </SheetBlock>
            <SheetBlock theme={theme}>
              <SheetList theme={theme}>
                <SheetListRow
                  theme={theme}
                  destructive
                  icon={<Trash2 {...iconProps} color={theme.color.danger} />}
                  title={ts.more.delete}
                  onPress={() => closeThen(onAskDelete)}
                />
              </SheetList>
            </SheetBlock>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 28, paddingBottom: 150 },
  hero: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingBottom: 32,
    overflow: "hidden",
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: { flex: 1, fontSize: 13, lineHeight: 18 },
  title: {
    marginTop: 8,
    maxWidth: 250,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  volume: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  volumeValue: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  volumeSub: { fontSize: 17, lineHeight: 22, fontVariant: ["tabular-nums"] },
  meta: { marginTop: 8, maxWidth: 240, fontSize: 13, lineHeight: 18 },
  section: { gap: 12 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: { fontSize: 15, lineHeight: 20 },
  card: { borderRadius: 24, overflow: "hidden" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 20 },
  rowValue: { fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 12, lineHeight: 16 },
  hint: { paddingHorizontal: 16, fontSize: 13, lineHeight: 18 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48.5%", flexGrow: 1, borderRadius: 20, padding: 16 },
  tileValueRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  tileValue: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  map: { height: 200 },
  lapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lapBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lapValue: { alignItems: "flex-end", gap: 2 },
  divided: { borderTopWidth: 1 },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 40,
    paddingHorizontal: 16,
  },
  splitHead: { minHeight: 36 },
  splitKm: { width: 32 },
  splitPace: { width: 44, textAlign: "right" },
  splitEl: { width: 36, textAlign: "right" },
  splitText: { fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  splitBar: { height: 8, borderRadius: 2, transform: [{ skewX: "-24deg" }] },
  how: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12 },
  howHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circles: { flexDirection: "row", justifyContent: "space-between" },
  notes: {
    minHeight: 72,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top",
    padding: 0,
  },
  distanceValue: { alignItems: "flex-end" },
  foot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 42,
    paddingHorizontal: 16,
  },
  saveButton: { flex: 0 },
  sheetScroll: { width: "100%" },
  sheetContent: { gap: 16, paddingTop: 72, paddingBottom: 32 },
  sheetButtons: { gap: 8, marginTop: 4 },
});
