import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Gauge,
  Heart,
  Play,
  Ruler as RulerIcon,
  Timer,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type AppLanguage, type MainCopy } from "../../../../locales";
import { getErrorMessage } from "../../../../shared/lib/error-message";
import { displayToKm, kmToDisplay } from "../../../../shared/lib/units";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../../shared/ui/bottom-sheet";
import {
  SheetList,
  SheetListRow,
  SheetSubtitle,
} from "../../../../shared/ui/sheet-list";
import {
  ValueSheet,
  type ValueSheetConfig,
} from "../../../../shared/ui/value-sheet";
import { InlineError } from "../../../plans/components/plans-ui";
import { useCurrentMetrics } from "../../../plans/hooks/use-plan-rebuild";
import { todayIso } from "../../../plans/lib/plan-dates";
import { useUnitFormat } from "../../../profile/hooks/use-unit-format";
import { formatClock } from "../../../tracker/format";
import { useCreateWorkout } from "../../hooks/use-workouts";
import { estimatedPaceSec } from "../../lib/goal-estimate";
import { pushSubScreen } from "../../main-routes";
import { defaultGoalDraft, GoalEditor, type GoalDraft } from "./goal-editor";

export type ManualWorkoutType = "easy" | "tempo" | "interval" | "hill" | "race";

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD, the day selected in the Today calendar
  workoutType: ManualWorkoutType;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Which sheet the selected day asks for. */
export type GoalSheetMode = "today" | "future" | "past";

export function goalSheetMode(date: string, today = todayIso()): GoalSheetMode {
  if (date === today) return "today";
  return date > today ? "future" : "past";
}

type PastLog = {
  distanceKm: number | null;
  durationSec: number | null;
  heartRate: number | null;
  rpe: number | null;
};

type Editing = "timeLimit" | keyof PastLog;

const EMPTY_LOG: PastLog = {
  distanceKm: null,
  durationSec: null,
  heartRate: null,
  rpe: null,
};

/**
 * One sheet for the type tiles and "+" on Today, chosen by the selected day:
 * today — the goal with "Start now" and "Add"; a future day — the goal with
 * "Add"; a past day — "How did it go" that saves a completed workout.
 * Only the value the athlete sets is sent; the other one is shown as an
 * estimate and never stored.
 */
export function WorkoutGoalSheet({
  visible,
  onClose,
  date,
  workoutType,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const s = copy.today.goalSheet;
  const format = useUnitFormat(copy, language);
  const units = format.units;
  const distanceUnit =
    units === "imperial" ? format.labels.mi : format.labels.km;
  const createWorkout = useCreateWorkout();
  const metrics = useCurrentMetrics(visible);
  const mode = goalSheetMode(date);

  // The sheet and its value sheets take turns: the open one slides away first.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const nextEdit = useRef<Editing | null>(null);

  const [draft, setDraft] = useState<GoalDraft>(() => defaultGoalDraft(units));
  const [log, setLog] = useState<PastLog>(EMPTY_LOG);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"start" | "add" | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(defaultGoalDraft(units));
    setLog(EMPTY_LOG);
    setError(null);
    setPending(null);
    setSheetOpen(true);
  }, [units, visible]);

  const thresholdPace = metrics.data?.thresholdPaceSecondsPerKm.value ?? null;
  const distanceKm = displayToKm(draft.distance, units);

  const openEdit = (field: Editing) => {
    nextEdit.current = field;
    setSheetOpen(false);
  };

  const onSheetClosed = () => {
    setSheetOpen(false);
    const field = nextEdit.current;
    nextEdit.current = null;
    if (field) setEditing(field);
    else onClose();
  };

  const scheduledAt = new Date(`${date}T09:00:00.000Z`).toISOString();

  const createPlanned = async (then: "start" | "add") => {
    if (pending) return;
    setPending(then);
    setError(null);
    try {
      const { goal, minutes, timeLimitMin } = draft;
      const created = await createWorkout.mutateAsync({
        scheduledAt,
        type: workoutType,
        status: "planned",
        goal,
        ...(goal === "duration" ? { durationMinutes: minutes } : {}),
        ...(goal === "distance"
          ? {
              distanceKm: Math.round(distanceKm * 100) / 100,
              ...(timeLimitMin ? { timeLimitMin } : {}),
            }
          : {}),
      });
      setSheetOpen(false);
      if (then === "start")
        pushSubScreen({ kind: "tracker-setup", plannedWorkoutId: created.id });
    } catch (createError) {
      setError(getErrorMessage(createError, copy.errors, s.errorDefault));
    } finally {
      setPending(null);
    }
  };

  const savePast = async () => {
    if (pending) return;
    if (!log.distanceKm || !log.durationSec) {
      setError(s.pastRequired);
      return;
    }
    setPending("add");
    setError(null);
    try {
      await createWorkout.mutateAsync({
        scheduledAt,
        type: workoutType,
        status: "completed",
        actualDistanceKm: log.distanceKm,
        actualDurationMinutes: Math.round((log.durationSec / 60) * 100) / 100,
        actualAveragePaceSecondsPerKm: Math.round(
          log.durationSec / log.distanceKm,
        ),
        ...(log.heartRate ? { actualAverageHeartRate: log.heartRate } : {}),
        ...(log.rpe ? { rpe: log.rpe } : {}),
      });
      setSheetOpen(false);
    } catch (createError) {
      setError(getErrorMessage(createError, copy.errors, s.errorDefault));
    } finally {
      setPending(null);
    }
  };

  const valueConfig = ((): ValueSheetConfig | null => {
    const labels = s.timeLabels;
    switch (editing) {
      case "timeLimit": {
        const estimateMin = Math.round(
          (distanceKm * estimatedPaceSec(workoutType, thresholdPace)) / 60,
        );
        return {
          kind: "duration",
          title: s.timeLimit,
          value: (draft.timeLimitMin ?? estimateMin) * 60,
          seconds: false,
          labels,
          secondary: draft.timeLimitMin
            ? { label: s.clear, value: null }
            : undefined,
          onSave: (value) =>
            setDraft((current) => ({
              ...current,
              timeLimitMin:
                value && value >= 60 ? Math.round(value / 60) : null,
            })),
        };
      }
      case "distanceKm":
        return {
          kind: "decimal",
          title: s.fields.distance,
          value: kmToDisplay(log.distanceKm ?? 5, units),
          max: 300,
          unit: distanceUnit,
          separator: copy.tracker.units.decimal,
          onSave: (value) =>
            setLog((current) => ({
              ...current,
              distanceKm:
                value && value > 0
                  ? Math.round(displayToKm(value, units) * 100) / 100
                  : null,
            })),
        };
      case "durationSec":
        return {
          kind: "duration",
          title: s.fields.duration,
          value: log.durationSec ?? 30 * 60,
          seconds: true,
          labels,
          onSave: (value) =>
            setLog((current) => ({
              ...current,
              durationSec: value && value > 0 ? value : null,
            })),
        };
      case "heartRate":
        return {
          kind: "integer",
          title: s.fields.heartRate,
          value: log.heartRate ?? 140,
          min: 40,
          max: 220,
          unit: s.bpm,
          secondary: log.heartRate
            ? { label: s.clear, value: null }
            : undefined,
          onSave: (value) =>
            setLog((current) => ({ ...current, heartRate: value })),
        };
      case "rpe":
        return {
          kind: "integer",
          title: s.fields.rpe,
          value: log.rpe ?? 5,
          min: 1,
          max: 10,
          secondary: log.rpe ? { label: s.clear, value: null } : undefined,
          onSave: (value) => setLog((current) => ({ ...current, rpe: value })),
        };
      default:
        return null;
    }
  })();

  const iconProps = {
    size: 20,
    color: theme.color.foreground,
    strokeWidth: 1.9,
  };

  return (
    <>
      <BottomSheet
        title={copy.today.types[workoutType]}
        visible={sheetOpen}
        animatedHide
        onClose={onSheetClosed}
        theme={theme}
        themeMode={themeMode}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SheetBlock theme={theme}>
            <SheetSubtitle
              text={mode === "past" ? s.pastTitle : s.title}
              theme={theme}
            />
          </SheetBlock>

          {mode === "past" ? (
            <SheetBlock theme={theme}>
              <SheetList theme={theme}>
                <SheetListRow
                  theme={theme}
                  icon={<RulerIcon {...iconProps} />}
                  title={s.fields.distance}
                  value={
                    log.distanceKm
                      ? format.distance(log.distanceKm, 2)
                      : s.empty.distance
                  }
                  valueStrong={Boolean(log.distanceKm)}
                  chevron
                  onPress={() => openEdit("distanceKm")}
                />
                <SheetListRow
                  theme={theme}
                  divided
                  icon={<Timer {...iconProps} />}
                  title={s.fields.duration}
                  value={
                    log.durationSec
                      ? formatClock(log.durationSec * 1000)
                      : s.empty.duration
                  }
                  valueStrong={Boolean(log.durationSec)}
                  chevron
                  onPress={() => openEdit("durationSec")}
                />
                <SheetListRow
                  theme={theme}
                  divided
                  icon={<Heart {...iconProps} />}
                  title={s.fields.heartRate}
                  value={
                    log.heartRate
                      ? `${log.heartRate} ${s.bpm}`
                      : s.empty.heartRate
                  }
                  valueStrong={Boolean(log.heartRate)}
                  chevron
                  onPress={() => openEdit("heartRate")}
                />
                <SheetListRow
                  theme={theme}
                  divided
                  icon={<Gauge {...iconProps} />}
                  title={s.fields.rpe}
                  value={log.rpe ? String(log.rpe) : s.empty.rpe}
                  valueStrong={Boolean(log.rpe)}
                  chevron
                  onPress={() => openEdit("rpe")}
                />
              </SheetList>
            </SheetBlock>
          ) : (
            <GoalEditor
              draft={draft}
              onChange={setDraft}
              onEditTimeLimit={() => openEdit("timeLimit")}
              workoutType={workoutType}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={language}
            />
          )}

          {error ? (
            <SheetBlock theme={theme}>
              <InlineError message={error} theme={theme} />
            </SheetBlock>
          ) : null}

          <SheetBlock theme={theme}>
            <View style={styles.buttons}>
              {mode === "past" ? (
                <SheetButton
                  label={s.save}
                  onPress={() => void savePast()}
                  pending={pending === "add"}
                  disabled={!log.distanceKm || !log.durationSec}
                  theme={theme}
                  themeMode={themeMode}
                />
              ) : null}
              {mode === "today" ? (
                <SheetButton
                  label={s.startNow}
                  leading={
                    <Play
                      size={16}
                      color={theme.color.primaryForeground}
                      fill={theme.color.primaryForeground}
                    />
                  }
                  onPress={() => void createPlanned("start")}
                  pending={pending === "start"}
                  disabled={pending !== null}
                  theme={theme}
                  themeMode={themeMode}
                />
              ) : null}
              {mode !== "past" ? (
                <SheetButton
                  label={s.submit}
                  variant={mode === "today" ? "secondary" : "primary"}
                  onPress={() => void createPlanned("add")}
                  pending={pending === "add"}
                  disabled={pending !== null}
                  theme={theme}
                  themeMode={themeMode}
                />
              ) : null}
            </View>
          </SheetBlock>
        </ScrollView>
      </BottomSheet>

      <ValueSheet
        config={valueConfig}
        onClose={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        doneLabel={s.done}
        theme={theme}
        themeMode={themeMode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { width: "100%" },
  content: { gap: 16, paddingTop: 72, paddingBottom: 32 },
  buttons: { gap: 8, marginTop: 4 },
});
