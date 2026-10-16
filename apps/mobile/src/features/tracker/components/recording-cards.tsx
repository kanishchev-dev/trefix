import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, SkipForward } from "lucide-react-native";

import type { ExecutionStep, RecordedLap } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import type { UnitSystem } from "../../../shared/lib/units";
import type { StepProgress } from "../engine/plan-progress";
import type { EngineView } from "../engine/types";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { formatStepSize, formatTargetPace } from "../plan-format";
import type { RunGoal } from "../storage/tracker-db";

type TrackerCopy = MainCopy["tracker"];

export type Fmt = {
  units: UnitSystem;
  locale: string;
  distanceUnit: string;
  paceUnit: string;
};

function fonts(theme: ThemeTokens) {
  return {
    muted: {
      color: theme.color.mutedForeground,
      fontFamily: theme.typography.fontFamily.sans.regular,
    },
    strong: {
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.sans.medium,
    },
  };
}

/** "Работа · повтор 2 из 6" */
export function stepTitle(step: ExecutionStep, t: TrackerCopy): string {
  const kind = t.stepKinds[step.kind];
  return step.repetition && step.kind === "work"
    ? `${kind} · ${fillTemplate(t.step.repetition, {
        index: step.repetition.index,
        total: step.repetition.total,
      })}`
    : kind;
}

/** "отдых 2 мин" */
function stepShort(step: ExecutionStep, t: TrackerCopy): string {
  return [t.stepKinds[step.kind].toLowerCase(), formatStepSize(step, t)]
    .filter(Boolean)
    .join(" ");
}

function stepLevel(step: ExecutionStep): 1 | 2 | 3 {
  if (step.kind === "work") return 3;
  if (step.kind === "steady") return 2;
  return 1;
}

/** Big "312 м осталось" / "1:23 осталось" of the running step. */
function Remaining({
  progress,
  fmt,
  t,
  theme,
}: {
  progress: StepProgress;
  fmt: Fmt;
  t: TrackerCopy;
  theme: ThemeTokens;
}) {
  const { muted, strong } = fonts(theme);
  let value: string;
  let label: string;
  if (progress.remainingM !== null) {
    if (progress.remainingM >= 1000) {
      value = formatDistanceValue(progress.remainingM, fmt.units, fmt.locale);
      label = fillTemplate(t.card.unitLeft, { unit: fmt.distanceUnit });
    } else {
      value = String(progress.remainingM);
      label = fillTemplate(t.card.unitLeft, { unit: t.units.m });
    }
  } else {
    value = formatClock((progress.remainingSec ?? 0) * 1000);
    label = t.card.left;
  }
  return (
    <View style={styles.remValue}>
      <Text numberOfLines={1} style={[styles.remBig, strong]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.remLabel, muted]}>
        {label}
      </Text>
    </View>
  );
}

/** Corridor scale: slower on the left, faster on the right, the current pace as a mark. */
export function PaceGauge({
  min,
  max,
  pace,
  fmt,
  t,
  theme,
}: {
  min: number;
  max: number;
  pace: number | null;
  fmt: Fmt;
  t: TrackerCopy;
  theme: ThemeTokens;
}) {
  const { muted, strong } = fonts(theme);
  const lo = min - 30;
  const hi = max + 30;
  const at = (value: number) =>
    Math.min(1, Math.max(0, (hi - value) / (hi - lo))) * 100;
  const position = pace !== null ? at(pace) : null;
  return (
    <View
      accessible
      accessibilityLabel={`${t.card.corridor} ${formatPaceValue(min, fmt.units)}–${formatPaceValue(max, fmt.units)}`}
      style={styles.gauge}
    >
      <View
        style={[styles.gaugeTrack, { backgroundColor: theme.color.screen }]}
      />
      <View
        style={[
          styles.gaugeBand,
          {
            backgroundColor: theme.color.intensity1,
            left: `${at(max)}%`,
            width: `${at(min) - at(max)}%`,
          },
        ]}
      />
      {position !== null ? (
        <>
          <View
            style={[
              styles.gaugeMark,
              { left: `${position}%`, backgroundColor: theme.color.foreground },
            ]}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.gaugeValue,
              strong,
              { left: `${position}%`, transform: [{ translateX: -20 }] },
            ]}
          >
            {formatPaceValue(pace, fmt.units)}
          </Text>
        </>
      ) : null}
      <Text style={[styles.gaugeLabel, muted, { left: 0 }]}>
        {t.card.slower}
      </Text>
      <Text style={[styles.gaugeLabel, muted, { right: 0 }]}>
        {t.card.faster}
      </Text>
    </View>
  );
}

/** Running step of a plan with several steps. */
export function PlanCard({
  view,
  steps,
  copy,
  fmt,
  theme,
  onSkip,
}: {
  view: EngineView;
  steps: ExecutionStep[];
  copy: MainCopy;
  fmt: Fmt;
  theme: ThemeTokens;
  onSkip?: () => void;
}) {
  const t = copy.tracker;
  const { muted, strong } = fonts(theme);
  const progress = view.step;
  if (!progress) return null;
  const { step, next } = progress;
  const heights = [8, 18, 30];
  const ramp = [
    theme.color.intensity1,
    theme.color.intensity2,
    theme.color.intensity3,
  ];
  const target = step.targetPace;
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <View style={styles.headRow}>
        <Text numberOfLines={1} style={[styles.head, strong]}>
          {stepTitle(step, t)}
        </Text>
        <Text numberOfLines={1} style={[styles.small, muted]}>
          {fillTemplate(t.step.of, {
            current: progress.index + 1,
            total: progress.total,
          })}
        </Text>
      </View>
      <View
        style={styles.strip}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {steps.map((item, index) => {
          const level = stepLevel(item);
          const current = index === progress.index;
          return (
            <View
              key={index}
              style={[
                styles.stripBar,
                {
                  flex: Math.max(
                    1,
                    item.durationSec ?? (item.distanceM ?? 0) * 0.3,
                  ),
                  height: heights[level - 1],
                  backgroundColor: current
                    ? theme.color.foreground
                    : ramp[level - 1],
                  opacity: current ? 1 : index < progress.index ? 0.45 : 0.2,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.remRow}>
        <Remaining progress={progress} fmt={fmt} t={t} theme={theme} />
        {target ? (
          <View style={styles.target}>
            <Text style={[styles.small, muted]}>{t.card.corridor}</Text>
            <Text numberOfLines={1} style={[styles.targetValue, strong]}>
              {`${formatPaceValue(target.minSecPerKm, fmt.units)}–${formatPaceValue(target.maxSecPerKm, fmt.units)}`}
            </Text>
          </View>
        ) : null}
      </View>
      {target ? (
        <PaceGauge
          min={target.minSecPerKm}
          max={target.maxSecPerKm}
          pace={view.currentPaceSecPerKm}
          fmt={fmt}
          t={t}
          theme={theme}
        />
      ) : null}
      <View style={styles.nextRow}>
        <Text numberOfLines={1} style={[styles.small, muted, styles.flex]}>
          {next
            ? fillTemplate(t.card.next, { step: stepShort(next, t) })
            : t.step.last}
        </Text>
        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.step.skip}
            onPress={onSkip}
            hitSlop={8}
            style={({ pressed }) => [
              styles.skip,
              { backgroundColor: theme.color.screen },
              pressed && styles.pressed,
            ]}
          >
            <SkipForward
              size={14}
              color={theme.color.foreground}
              strokeWidth={2}
            />
            <Text style={[styles.skipText, strong]}>{t.card.skip}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Shown for a few seconds after a step ends: how it went and what is next. */
export function StepDoneCard({
  lap,
  step,
  total,
  next,
  secondsLeft,
  copy,
  fmt,
  theme,
}: {
  lap: RecordedLap;
  step: ExecutionStep;
  total: number;
  next: ExecutionStep | null;
  secondsLeft: number;
  copy: MainCopy;
  fmt: Fmt;
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  const { muted, strong } = fonts(theme);
  const size =
    lap.plannedM != null
      ? `${Math.round(lap.actualM)} ${t.units.m}`
      : formatStepSize({ durationSec: lap.actualSec, distanceM: null }, t);
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        styles.doneCard,
        { backgroundColor: theme.color.card },
      ]}
    >
      <View style={styles.headRow}>
        <Text numberOfLines={1} style={[styles.small, muted]}>
          {fillTemplate(t.card.stepDone, { current: lap.index + 1, total })}
        </Text>
        <View
          style={[styles.doneBox, { backgroundColor: theme.color.primary }]}
        >
          <Check
            size={16}
            color={theme.color.primaryForeground}
            strokeWidth={2.6}
          />
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.doneTitle, strong]}>
        {stepTitle(step, t)}
      </Text>
      <View style={styles.doneBig}>
        <Text style={[styles.doneValue, strong]}>
          {formatPaceValue(lap.avgPaceSecPerKm ?? null, fmt.units)}
        </Text>
        <Text numberOfLines={1} style={[styles.doneUnit, muted]}>
          {[fmt.paceUnit, lap.inTarget ? t.card.inCorridor : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.small, muted, styles.doneLine]}>
        {fillTemplate(t.card.distanceIn, {
          distance: size ?? "",
          time: formatClock(lap.actualSec * 1000),
        })}
      </Text>
      <View
        style={[
          styles.box,
          styles.doneNext,
          { backgroundColor: theme.color.screen },
        ]}
      >
        <View style={styles.flex}>
          <Text style={[styles.small, muted]}>{t.card.then}</Text>
          <Text numberOfLines={1} style={[styles.boxValue, strong]}>
            {next ? stepShort(next, t) : t.step.last}
          </Text>
        </View>
        <Text style={[styles.countdown, strong]}>
          {formatClock(secondsLeft * 1000)}
        </Text>
      </View>
    </View>
  );
}

/** A run towards a time goal: what is left, the progress and the current pace. */
export function TimeGoalCard({
  view,
  goal,
  title,
  goalLabel,
  copy,
  fmt,
  theme,
}: {
  view: EngineView;
  goal: RunGoal;
  title: string;
  /** "50 мин" */
  goalLabel: string;
  copy: MainCopy;
  fmt: Fmt;
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  const { muted, strong } = fonts(theme);
  const totalMs = (goal.durationSec ?? 0) * 1000;
  const leftMs = Math.max(0, totalMs - view.movingMs);
  const done = leftMs === 0;
  const fraction = totalMs > 0 ? Math.min(1, view.movingMs / totalMs) : 0;
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <View style={styles.headRow}>
        <Text numberOfLines={1} style={[styles.head, strong]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.small, muted]}>
          {fillTemplate(t.card.goalTime, { value: goalLabel })}
        </Text>
      </View>
      <View style={styles.remRow}>
        <View style={styles.remValue}>
          <Text numberOfLines={1} style={[styles.remBig, strong]}>
            {formatClock(leftMs)}
          </Text>
          <Text numberOfLines={1} style={[styles.remLabel, muted]}>
            {done ? t.card.goalDone : t.card.left}
          </Text>
        </View>
      </View>
      <ProgressBar fraction={fraction} theme={theme} />
      <View style={styles.barLabels}>
        <Text style={[styles.tiny, muted]}>
          {fillTemplate(t.card.passed, { time: formatClock(view.movingMs) })}
        </Text>
        <Text style={[styles.tiny, muted]}>{formatClock(totalMs)}</Text>
      </View>
      <View style={[styles.box, { backgroundColor: theme.color.screen }]}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.small, muted]}>
            {view.onPedometer ? t.card.pedometerPace : t.metrics.pace}
          </Text>
          <Text numberOfLines={1} style={[styles.boxValue, strong]}>
            {`${formatPaceValue(view.currentPaceSecPerKm, fmt.units)} ${fmt.paceUnit}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A run towards a distance (in a time limit): what is left, the corridor and the forecast. */
export function DistanceGoalCard({
  view,
  goal,
  title,
  copy,
  fmt,
  theme,
}: {
  view: EngineView;
  goal: RunGoal;
  title: string;
  copy: MainCopy;
  fmt: Fmt;
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  const { muted, strong } = fonts(theme);
  const totalM = goal.distanceM ?? 0;
  const leftM = Math.max(0, totalM - view.distanceM);
  const fraction = totalM > 0 ? Math.min(1, view.distanceM / totalM) : 0;
  const target = view.step?.step.targetPace ?? null;
  const distanceText = `${formatDistanceValue(totalM, fmt.units, fmt.locale)} ${fmt.distanceUnit}`;
  const limitMs = (goal.timeLimitSec ?? 0) * 1000;
  const forecastMs =
    view.avgPaceSecPerKm !== null && totalM > 0
      ? view.movingMs + leftM * view.avgPaceSecPerKm
      : null;
  const expectedMs = totalM > 0 ? (view.distanceM / totalM) * limitMs : 0;
  const deltaMs = expectedMs - view.movingMs;
  const scheduleText =
    Math.abs(deltaMs) < 5000
      ? t.card.onTrack
      : fillTemplate(deltaMs > 0 ? t.card.ahead : t.card.behind, {
          delta: formatClock(Math.abs(deltaMs)),
        });
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <View style={styles.headRow}>
        <Text numberOfLines={1} style={[styles.head, strong]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.small, muted]}>
          {limitMs > 0
            ? fillTemplate(t.card.distanceIn, {
                distance: distanceText,
                time: formatClock(limitMs),
              })
            : fillTemplate(t.card.goalTime, { value: distanceText })}
        </Text>
      </View>
      <View style={styles.barTop}>
        <ProgressBar fraction={fraction} theme={theme} />
      </View>
      <View style={styles.remRow}>
        <View style={styles.remValue}>
          <Text numberOfLines={1} style={[styles.remBig, strong]}>
            {formatDistanceValue(leftM, fmt.units, fmt.locale)}
          </Text>
          <Text numberOfLines={1} style={[styles.remLabel, muted]}>
            {fillTemplate(t.card.unitLeft, { unit: fmt.distanceUnit })}
          </Text>
        </View>
        {target ? (
          <View style={styles.target}>
            <Text style={[styles.small, muted]}>{t.card.corridor}</Text>
            <Text numberOfLines={1} style={[styles.targetValue, strong]}>
              {`${formatPaceValue(target.minSecPerKm, fmt.units)}–${formatPaceValue(target.maxSecPerKm, fmt.units)}`}
            </Text>
          </View>
        ) : null}
      </View>
      {target ? (
        <PaceGauge
          min={target.minSecPerKm}
          max={target.maxSecPerKm}
          pace={view.currentPaceSecPerKm}
          fmt={fmt}
          t={t}
          theme={theme}
        />
      ) : null}
      {limitMs > 0 ? (
        <View style={[styles.box, { backgroundColor: theme.color.screen }]}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.small, muted]}>
              {fillTemplate(t.card.toFinish, { time: formatClock(limitMs) })}
            </Text>
            <Text numberOfLines={1} style={[styles.boxValue, strong]}>
              {scheduleText}
            </Text>
          </View>
          {forecastMs !== null ? (
            <Text numberOfLines={1} style={[styles.small, muted]}>
              {fillTemplate(t.card.forecast, { time: formatClock(forecastMs) })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ProgressBar({
  fraction,
  theme,
}: {
  fraction: number;
  theme: ThemeTokens;
}) {
  return (
    <View style={[styles.bar, { backgroundColor: theme.color.screen }]}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.round(fraction * 100)}%`,
            backgroundColor: theme.color.foreground,
          },
        ]}
      />
    </View>
  );
}

export type MetricCell = {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  unit?: string | null;
};

/** 2 × 2 cells; a long press asks which value to show instead. */
export function MetricGrid({
  cells,
  theme,
  onLongPress,
}: {
  cells: MetricCell[];
  theme: ThemeTokens;
  onLongPress?: (index: number) => void;
}) {
  const { muted, strong } = fonts(theme);
  return (
    <View style={[styles.grid, { backgroundColor: theme.color.screen }]}>
      {cells.map((cell, index) => (
        <Pressable
          key={`${cell.key}-${index}`}
          accessibilityLabel={`${cell.label} ${cell.value} ${cell.unit ?? ""}`}
          disabled={!onLongPress}
          onLongPress={() => onLongPress?.(index)}
          delayLongPress={450}
          style={[styles.cell, { backgroundColor: theme.color.card }]}
        >
          <View style={styles.cellLabel}>
            {cell.icon}
            <Text numberOfLines={1} style={[styles.small, muted]}>
              {cell.label}
            </Text>
          </View>
          <View style={styles.cellValueRow}>
            <Text numberOfLines={1} style={[styles.cellValue, strong]}>
              {cell.value}
            </Text>
            {cell.unit ? (
              <Text numberOfLines={1} style={[styles.cellUnit, muted]}>
                {cell.unit}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** Steps of the plan as a timeline: done ones with their result, the running one with what is left. */
export function StepsList({
  steps,
  laps,
  view,
  copy,
  fmt,
  theme,
}: {
  steps: ExecutionStep[];
  laps: RecordedLap[];
  view: EngineView;
  copy: MainCopy;
  fmt: Fmt;
  theme: ThemeTokens;
}) {
  const t = copy.tracker;
  const { muted, strong } = fonts(theme);
  const current = view.step?.index ?? steps.length;
  const from = Math.max(0, Math.min(current - 3, steps.length - 7));
  const shown = steps.slice(from, from + 7);
  const rest = steps.length - (from + shown.length);
  return (
    <View style={[styles.stepsCard, { backgroundColor: theme.color.card }]}>
      {shown.map((step, offset) => {
        const index = from + offset;
        const done = index < current;
        const running = index === current;
        const lap = laps.find((item) => item.index === step.index);
        const line = (active: boolean) =>
          active ? theme.color.foreground : theme.color.intensity1;
        return (
          <View
            key={index}
            style={[
              styles.stepRow,
              offset > 0 && {
                borderTopWidth: 1,
                borderTopColor: theme.color.screen,
              },
            ]}
          >
            <View style={styles.rail}>
              {index > 0 ? (
                <View
                  style={[
                    styles.railTop,
                    { backgroundColor: line(done || running) },
                  ]}
                />
              ) : null}
              {index < steps.length - 1 ? (
                <View
                  style={[styles.railBottom, { backgroundColor: line(done) }]}
                />
              ) : null}
              <View
                style={[
                  styles.railDot,
                  done
                    ? { backgroundColor: theme.color.foreground }
                    : running
                      ? {
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          borderWidth: 2.5,
                          borderColor: theme.color.foreground,
                          backgroundColor: theme.color.card,
                        }
                      : {
                          borderWidth: 2,
                          borderColor: theme.color.intensity1,
                          backgroundColor: theme.color.card,
                        },
                ]}
              />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.small, muted]}>
                {stepTitle(step, t)}
              </Text>
              <Text numberOfLines={1} style={[styles.stepSize, strong]}>
                {formatStepSize(step, t) ?? ""}
              </Text>
              <Text numberOfLines={1} style={[styles.small, muted]}>
                {formatTargetPace(step, fmt.units, fmt.paceUnit) ?? ""}
              </Text>
            </View>
            {done && lap ? (
              <View style={styles.stepValue}>
                <Text numberOfLines={1} style={[styles.stepValueText, strong]}>
                  {lap.plannedM != null
                    ? formatPaceValue(lap.avgPaceSecPerKm ?? null, fmt.units)
                    : formatClock(lap.actualSec * 1000)}
                </Text>
                <Text numberOfLines={1} style={[styles.small, muted]}>
                  {lap.plannedM != null
                    ? formatClock(lap.actualSec * 1000)
                    : formatPaceValue(lap.avgPaceSecPerKm ?? null, fmt.units)}
                </Text>
              </View>
            ) : running && view.step ? (
              <View style={styles.stepValue}>
                <Text numberOfLines={1} style={[styles.stepValueText, strong]}>
                  {view.step.remainingM !== null
                    ? `${view.step.remainingM} ${t.units.m}`
                    : formatClock((view.step.remainingSec ?? 0) * 1000)}
                </Text>
                <Text numberOfLines={1} style={[styles.small, muted]}>
                  {t.card.left}
                </Text>
              </View>
            ) : (
              <View style={styles.meter}>
                {[9, 14, 19].map((height, level) => (
                  <View
                    key={height}
                    style={[
                      styles.meterBar,
                      {
                        height,
                        backgroundColor:
                          level < stepLevel(step)
                            ? [
                                theme.color.intensity1,
                                theme.color.intensity2,
                                theme.color.intensity3,
                              ][level]
                            : theme.color.screen,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
      {rest > 0 ? (
        <Text
          style={[
            styles.small,
            muted,
            styles.more,
            { borderTopColor: theme.color.screen },
          ]}
        >
          {fillTemplate(t.card.moreSteps, { count: rest })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  head: { flex: 1, fontSize: 15, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  flex: { flex: 1, minWidth: 0 },
  strip: {
    marginTop: 12,
    height: 30,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  stripBar: { minWidth: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  remRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  remValue: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexShrink: 1,
  },
  remBig: {
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -2.5,
    fontVariant: ["tabular-nums"],
  },
  remLabel: { fontSize: 17, lineHeight: 22 },
  target: { alignItems: "flex-end", gap: 2, paddingBottom: 8 },
  targetValue: { fontSize: 17, lineHeight: 22, fontVariant: ["tabular-nums"] },
  gauge: { marginTop: 14, height: 46 },
  gaugeTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 22,
    height: 10,
    borderRadius: 5,
  },
  gaugeBand: { position: "absolute", top: 22, height: 10, borderRadius: 5 },
  gaugeMark: {
    position: "absolute",
    top: 16,
    width: 4,
    height: 22,
    marginLeft: -2,
    borderRadius: 2,
  },
  gaugeValue: {
    position: "absolute",
    top: 0,
    width: 40,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  gaugeLabel: { position: "absolute", top: 36, fontSize: 11, lineHeight: 14 },
  nextRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skipText: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.8 },
  doneCard: { minHeight: 291 },
  doneBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  doneBig: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  doneValue: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  doneUnit: { fontSize: 17, lineHeight: 22 },
  doneLine: { marginTop: 4 },
  doneNext: { marginTop: "auto" },
  box: {
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  boxValue: { fontSize: 15, lineHeight: 20 },
  countdown: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  bar: { marginTop: 14, height: 10, borderRadius: 5, overflow: "hidden" },
  barTop: { marginTop: -2 },
  barFill: { height: "100%", borderRadius: 5 },
  barLabels: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  grid: {
    borderRadius: 24,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  cell: {
    width: "49.7%",
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  cellLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  cellValueRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  cellValue: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  cellUnit: { fontSize: 14, lineHeight: 18 },
  stepsCard: { borderRadius: 24, overflow: "hidden" },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rail: {
    width: 28,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -10,
  },
  railTop: { position: "absolute", top: 0, bottom: "50%", width: 2 },
  railBottom: { position: "absolute", top: "50%", bottom: 0, width: 2 },
  railDot: { width: 12, height: 12, borderRadius: 6 },
  stepSize: { fontSize: 15, lineHeight: 20 },
  stepValue: { alignItems: "flex-end", gap: 1 },
  stepValueText: {
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  meter: { height: 20, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  meterBar: { width: 5, borderRadius: 1, transform: [{ skewX: "-24deg" }] },
  more: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
});
