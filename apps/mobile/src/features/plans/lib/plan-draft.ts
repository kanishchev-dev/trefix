import {
  ATHLETE_GOAL_TYPES,
  PLAN_METRIC_RANGES,
  type AthleteGoalType,
  type AthleteMetrics,
  type CurrentMetrics,
  type ManualPlanPreview,
  type ManualPlanPreviewWeek,
  type MetricsSnapshot,
  type MetricsSource,
  type PlanConfig,
  type PlanDetails,
  type RecentResult,
  type RelativeWeek,
  type ManualPlanStructureInput,
  manualPlanStructureSchema,
  previewWeekPhase,
  previewWorkoutPhase,
} from "@workspace/api-client";

import {
  INITIAL_PLAN_CREATION_DRAFT,
  type PlanCreationDraft,
} from "../../plan-creation/plan-creation-types";

type ConfigInput = {
  goal?: Record<string, unknown>;
  schedule?: PlanConfig["schedule"];
  structure?: PlanConfig["structure"];
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

type PlanFocus = NonNullable<ManualPlanStructureInput["focus"]>[number];

const isPlanFocus = (value: string): value is PlanFocus =>
  manualPlanStructureSchema.shape.focus.unwrap().element.safeParse(value)
    .success;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

function isGoalType(value: unknown): value is AthleteGoalType {
  return (
    typeof value === "string" &&
    (ATHLETE_GOAL_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Creation-flow draft from stored plan parameters (prefill of rebuild and of
 * draft parameter editing). Missing values fall back to the defaults of a new plan.
 */
export function draftFromConfig(
  config: ConfigInput,
  overrides: { targetDate?: string | null } = {},
): PlanCreationDraft {
  const base = INITIAL_PLAN_CREATION_DRAFT;
  const goal = config.goal ?? {};
  const schedule: Partial<PlanConfig["schedule"]> = config.schedule ?? {};
  const structure: Partial<PlanConfig["structure"]> = config.structure ?? {};

  const goalType = isGoalType(goal.type) ? goal.type : base.goal.type;
  const targetDate =
    overrides.targetDate !== undefined
      ? (overrides.targetDate ?? undefined)
      : asString(goal.targetDate);
  const raceDistance = asString(
    goal.raceDistance,
  ) as PlanCreationDraft["goal"]["raceDistance"];

  const trainingDays = (schedule.trainingDays ?? []).filter(
    (day) => day >= 0 && day <= 6,
  );
  const days =
    trainingDays.length > 0
      ? [...trainingDays].sort((a, b) => a - b)
      : base.schedule.trainingDays;
  const longRunDay = asNumber(schedule.preferredLongRunDay);

  const sessionsPerWeek = Math.min(
    asNumber(structure.sessionsPerWeek) ?? base.structure.sessionsPerWeek,
    days.length,
  );

  return {
    goal: {
      type: goalType,
      target:
        asRecord(goal.target) ??
        (goalType === base.goal.type ? base.goal.target : undefined),
      current: asRecord(goal.current),
      description: asString(goal.description),
      targetDate,
      priority: asNumber(goal.priority),
      raceDistance,
      targetTimeSeconds: asNumber(goal.targetTimeSeconds),
    },
    schedule: {
      trainingDays: days,
      preferredLongRunDay:
        longRunDay !== undefined && days.includes(longRunDay)
          ? longRunDay
          : undefined,
      workoutDurationMinutes:
        asNumber(schedule.workoutDurationMinutes) ??
        base.schedule.workoutDurationMinutes,
    },
    structure: {
      totalWeeks: asNumber(structure.totalWeeks) ?? base.structure.totalWeeks,
      sessionsPerWeek: Math.max(1, sessionsPerWeek),
      focus: structure.focus?.filter(isPlanFocus) ?? base.structure.focus,
    },
  };
}

/** Structure fields whose change makes the server rebuild the plan from scratch. */
export function structureChanged(
  initial: PlanCreationDraft,
  current: PlanCreationDraft,
): boolean {
  const focus = (value: PlanCreationDraft) =>
    [...(value.structure.focus ?? [])].sort().join(",");
  return (
    initial.structure.totalWeeks !== current.structure.totalWeeks ||
    initial.structure.sessionsPerWeek !== current.structure.sessionsPerWeek ||
    focus(initial) !== focus(current)
  );
}

/** Goal payload of the creation draft as the API expects it. */
export function goalPayload(draft: PlanCreationDraft) {
  return {
    type: draft.goal.type,
    target: draft.goal.target,
    current: draft.goal.current,
    description: draft.goal.description,
    targetDate: draft.goal.targetDate,
    priority: draft.goal.priority,
  };
}

// ----------------------------------------------------------- current metrics

export type ThresholdMode = "pace" | "result";

export type MetricsForm = {
  thresholdMode: ThresholdMode;
  thresholdPaceSecondsPerKm: number | null;
  recentResult: RecentResult | null;
  weeklyMileageKm: number | null;
  longestRunKm: number | null;
  maxHeartRate: number | null;
  restingHeartRate: number | null;
};

export type MetricsField = Exclude<keyof MetricsForm, "thresholdMode">;

export type MetricsSources = Partial<Record<MetricsField, MetricsSource>>;

export const EMPTY_METRICS_FORM: MetricsForm = {
  thresholdMode: "pace",
  thresholdPaceSecondsPerKm: null,
  recentResult: null,
  weeklyMileageKm: null,
  longestRunKm: null,
  maxHeartRate: null,
  restingHeartRate: null,
};

/** "Now" values prefilled from the server estimate; unknown values stay empty. */
export function metricsFormFromCurrent(current: CurrentMetrics | undefined): {
  form: MetricsForm;
  sources: MetricsSources;
} {
  if (!current) return { form: EMPTY_METRICS_FORM, sources: {} };
  const hasPace = current.thresholdPaceSecondsPerKm.value !== null;
  const hasResult = current.recentResult.value !== null;
  return {
    form: {
      thresholdMode: !hasPace && hasResult ? "result" : "pace",
      thresholdPaceSecondsPerKm: current.thresholdPaceSecondsPerKm.value,
      recentResult: current.recentResult.value,
      weeklyMileageKm: current.weeklyMileageKm.value,
      longestRunKm: current.longestRunKm.value,
      maxHeartRate: current.maxHeartRate.value,
      restingHeartRate: current.restingHeartRate.value,
    },
    sources: {
      thresholdPaceSecondsPerKm: current.thresholdPaceSecondsPerKm.source,
      recentResult: current.recentResult.source,
      weeklyMileageKm: current.weeklyMileageKm.source,
      longestRunKm: current.longestRunKm.source,
      maxHeartRate: current.maxHeartRate.source,
      restingHeartRate: current.restingHeartRate.source,
    },
  };
}

/** Payload of the metrics step: only filled values; the threshold comes from one source. */
export function metricsPayload(form: MetricsForm): AthleteMetrics {
  const payload: AthleteMetrics = {};
  if (
    form.thresholdMode === "pace" &&
    form.thresholdPaceSecondsPerKm !== null
  ) {
    payload.thresholdPaceSecondsPerKm = form.thresholdPaceSecondsPerKm;
  }
  if (form.thresholdMode === "result" && form.recentResult) {
    payload.recentResult = form.recentResult;
  }
  if (form.weeklyMileageKm !== null)
    payload.weeklyMileageKm = form.weeklyMileageKm;
  if (form.longestRunKm !== null) payload.longestRunKm = form.longestRunKm;
  if (form.maxHeartRate !== null)
    payload.maxHeartRate = Math.round(form.maxHeartRate);
  if (form.restingHeartRate !== null)
    payload.restingHeartRate = Math.round(form.restingHeartRate);
  return payload;
}

export type MetricsErrors = Partial<
  Record<MetricsField, "required" | "outOfRange">
>;

const RANGE_FIELDS = [
  "thresholdPaceSecondsPerKm",
  "weeklyMileageKm",
  "longestRunKm",
  "maxHeartRate",
  "restingHeartRate",
] as const;

/**
 * Client-side check of the metrics step. Volume and the longest run are the
 * scaling baseline, so they are required when `requireVolume` is set.
 */
export function validateMetricsForm(
  form: MetricsForm,
  options: { requireVolume: boolean },
): MetricsErrors {
  const errors: MetricsErrors = {};
  for (const field of RANGE_FIELDS) {
    const value = form[field];
    if (field === "thresholdPaceSecondsPerKm" && form.thresholdMode !== "pace")
      continue;
    if (value === null) continue;
    const range = PLAN_METRIC_RANGES[field];
    if (value < range.min || value > range.max) errors[field] = "outOfRange";
  }
  if (options.requireVolume) {
    if (form.weeklyMileageKm === null) errors.weeklyMileageKm = "required";
    if (form.longestRunKm === null) errors.longestRunKm = "required";
  }
  return errors;
}

/** "Last time" value of a metric from the source plan snapshot. */
export function previousMetricValue(
  snapshot: MetricsSnapshot | null | undefined,
  field: MetricsField,
) {
  if (!snapshot) return null;
  return snapshot[field] ?? null;
}

// ------------------------------------------------------- relative structures

/**
 * Draft weeks in the preview format, so the existing preview editor can edit
 * a stored draft. Workout ids are the relative keys; there are no dates yet.
 */
export function relativeWeeksToPreview(
  weeks: RelativeWeek[],
  details: Pick<PlanDetails, "totalWeeks" | "sessionsPerWeek">,
): ManualPlanPreview {
  const previewWeeks: ManualPlanPreviewWeek[] = weeks.map((week) => {
    const workouts = [...week.workouts]
      .sort(
        (left, right) =>
          left.dayOfWeek - right.dayOfWeek ||
          left.orderInWeek - right.orderInWeek,
      )
      .map((workout) => ({
        id: workout.key,
        type: workout.type,
        phase: previewWorkoutPhase(workout.phase),
        weekNumber: week.weekNumber,
        dayOfWeek: workout.dayOfWeek,
        scheduledAt: "",
        orderInWeek: workout.orderInWeek,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      }));
    return {
      weekNumber: week.weekNumber,
      phase: previewWeekPhase(week.phase),
      title: week.title ?? "",
      plannedWorkoutsCount: workouts.length,
      plannedDistance: workouts.reduce(
        (sum, workout) => sum + workout.distanceKm,
        0,
      ),
      plannedLoad: week.weeklyLoadTarget ?? 0,
      workouts,
    };
  });
  return {
    startDate: "",
    endDate: "",
    totalWeeks: details.totalWeeks || weeks.length,
    trainingFrequency:
      details.sessionsPerWeek ??
      Math.max(0, ...previewWeeks.map((week) => week.workouts.length)),
    weeklyTargetKm: 0,
    weeks: previewWeeks,
  };
}

/** Relative weeks stored on a draft; dated plans carry `workoutIds` instead. */
export function relativeWeeksOf(details: PlanDetails): RelativeWeek[] {
  return details.weeks
    .filter((week) => Array.isArray(week.workouts))
    .map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      title: week.title,
      intent: week.intent,
      weeklyLoadTarget: week.weeklyLoadTarget,
      workouts: week.workouts ?? [],
    }));
}
