import {
  ATHLETE_GOAL_TYPES,
  type AthleteGoalType,
  type AthleteMetrics,
  type CreateManualPlanInput,
  type CurrentMetrics,
  type ManualPlanGoalInput,
  type PlanStartOption,
  type PreviewManualPlanInput,
  type RebuildInput,
  type RebuildPrefill,
  type RebuildPreviewInput,
  type RebuildTarget,
} from "@workspace/api-client";
import { formatGoalFields, parseGoal } from "./goal-fields";
import {
  formatDuration,
  formatPace,
  parseDuration,
  parsePace,
} from "./plan-format";
import {
  PLAN_WIZARD_LIMITS,
  PLAN_FOCUS_TYPES,
  RECENT_RESULT_DISTANCES,
  clamp,
  type PlanFocusType,
  type PlanWizardMetrics,
  type PlanWizardValues,
} from "./plan-wizard-schema";

export const EMPTY_METRICS: PlanWizardMetrics = {
  thresholdPace: "",
  thresholdHeartRate: "",
  maxHeartRate: "",
  restingHeartRate: "",
  weeklyMileageKm: "",
  longestRunKm: "",
  recentDistance: "",
  recentTime: "",
  recentDate: "",
};

/** Starting point of a new plan: the same defaults the app uses. */
export function getDefaultWizardValues(): PlanWizardValues {
  return {
    goalType: "prepare_for_race",
    goalTarget: { distanceMeters: "10" },
    goalCurrent: {},
    goalDescription: "",
    goalTargetDate: "",
    trainingDays: [0, 2, 5],
    preferredLongRunDay: null,
    workoutDurationMinutes: 45,
    totalWeeks: 8,
    sessionsPerWeek: 3,
    focus: ["easy", "long_run", "tempo"],
    metrics: EMPTY_METRICS,
    name: "",
    notes: "",
    saveMode: "draft",
    startKind: "",
    replaceActive: false,
  };
}

/** Fills the metrics step with the athlete's current estimate. */
export function metricsFromCurrent(current: CurrentMetrics): PlanWizardMetrics {
  const text = (value: number | null) =>
    value === null ? "" : String(Math.round(value * 10) / 10);
  const recent = current.recentResult.value;

  return {
    thresholdPace:
      current.thresholdPaceSecondsPerKm.value === null
        ? ""
        : formatPace(current.thresholdPaceSecondsPerKm.value),
    thresholdHeartRate: text(current.thresholdHeartRate.value),
    maxHeartRate: text(current.maxHeartRate.value),
    restingHeartRate: text(current.restingHeartRate.value),
    weeklyMileageKm: text(current.weeklyMileageKm.value),
    longestRunKm: text(current.longestRunKm.value),
    recentDistance: isRecentDistance(recent?.distance) ? recent.distance : "",
    recentTime: recent ? formatDuration(recent.timeSeconds) : "",
    recentDate: recent?.date.slice(0, 10) ?? "",
  };
}

/**
 * "Prepare again" starts from the source plan's parameters, the suggested
 * new goal date and the athlete's current metrics.
 */
export function valuesFromRebuildPrefill(
  prefill: RebuildPrefill,
  planName: string,
): PlanWizardValues {
  const defaults = getDefaultWizardValues();
  const goal = prefill.config.goal as Partial<ManualPlanGoalInput> &
    Record<string, unknown>;
  const goalType = isGoalType(goal.type) ? goal.type : defaults.goalType;
  const { schedule, structure } = prefill.config;

  return {
    ...defaults,
    goalType,
    goalTarget: formatGoalFields(asRecord(goal.target)),
    goalCurrent: formatGoalFields(asRecord(goal.current)),
    goalDescription:
      typeof goal.description === "string" ? goal.description : "",
    goalTargetDate: prefill.goalSuggestion.targetDate ?? "",
    trainingDays: schedule.trainingDays?.length
      ? schedule.trainingDays
      : defaults.trainingDays,
    preferredLongRunDay: schedule.preferredLongRunDay ?? null,
    workoutDurationMinutes:
      schedule.workoutDurationMinutes ?? defaults.workoutDurationMinutes,
    totalWeeks: clamp(
      structure.totalWeeks ?? defaults.totalWeeks,
      PLAN_WIZARD_LIMITS.weeks,
    ),
    sessionsPerWeek: structure.sessionsPerWeek ?? defaults.sessionsPerWeek,
    focus: (structure.focus ?? []).filter(isFocusType),
    metrics: metricsFromCurrent(prefill.metrics.current),
    name: planName,
  };
}

// ------------------------------------------------------------------ payloads

export function buildGoal(values: PlanWizardValues): ManualPlanGoalInput {
  const goal = parseGoal(
    values.goalType,
    values.goalTarget,
    values.goalCurrent,
    values.goalDescription,
  );
  const description = values.goalDescription.trim();

  return {
    type: values.goalType,
    target: goal.target,
    current: goal.current,
    description: description.length > 0 ? description : null,
    targetDate: values.goalTargetDate || undefined,
  };
}

export function buildConfig(
  values: PlanWizardValues,
): Pick<PreviewManualPlanInput, "schedule" | "structure"> {
  return {
    schedule: {
      trainingDays: [...values.trainingDays].sort((a, b) => a - b),
      preferredLongRunDay: values.preferredLongRunDay ?? undefined,
      workoutDurationMinutes: values.workoutDurationMinutes,
    },
    structure: {
      totalWeeks: values.totalWeeks,
      sessionsPerWeek: values.sessionsPerWeek,
      focus: values.focus,
    },
  };
}

export function buildMetrics(metrics: PlanWizardMetrics): AthleteMetrics {
  const result: AthleteMetrics = {};
  const pace = parsePace(metrics.thresholdPace);
  if (pace !== null) result.thresholdPaceSecondsPerKm = pace;

  const integer = (value: string) =>
    value.trim() === "" ? undefined : Number(value);
  const decimal = (value: string) =>
    value.trim() === "" ? undefined : Number(value.replace(",", "."));
  const assign = <K extends keyof AthleteMetrics>(
    key: K,
    value: AthleteMetrics[K] | undefined,
  ) => {
    if (value !== undefined && !Number.isNaN(value)) result[key] = value;
  };

  assign("thresholdHeartRate", integer(metrics.thresholdHeartRate));
  assign("maxHeartRate", integer(metrics.maxHeartRate));
  assign("restingHeartRate", integer(metrics.restingHeartRate));
  assign("weeklyMileageKm", decimal(metrics.weeklyMileageKm));
  assign("longestRunKm", decimal(metrics.longestRunKm));

  const time = parseDuration(metrics.recentTime);
  if (
    metrics.recentDistance !== "" &&
    time !== null &&
    metrics.recentDate !== ""
  ) {
    result.recentResult = {
      distance: metrics.recentDistance,
      timeSeconds: time,
      date: metrics.recentDate,
    };
  }
  return result;
}

export function toPreviewInput(
  values: PlanWizardValues,
  timezone: string,
): PreviewManualPlanInput {
  return {
    goal: buildGoal(values),
    ...buildConfig(values),
    metrics: buildMetrics(values.metrics),
    timezone,
  };
}

export function toRebuildPreviewInput(
  values: PlanWizardValues,
  target: RebuildTarget,
  timezone: string,
): RebuildPreviewInput {
  return {
    ...toPreviewInput(values, timezone),
    metrics: buildMetrics(values.metrics),
    target,
  };
}

/** Name, notes and save mode shared by creation and rebuild. */
export function buildSaveFields(
  values: PlanWizardValues,
  startOption: PlanStartOption | null,
  timezone: string,
) {
  const name = values.name.trim();
  const notes = values.notes.trim();
  const saveFields = {
    name: name.length > 0 ? name : undefined,
    notes: notes.length > 0 ? notes : null,
  };

  if (values.saveMode === "draft" || !startOption) {
    return { ...saveFields, saveAsDraft: true };
  }

  return {
    ...saveFields,
    saveAsDraft: false,
    start: {
      startDate: startOption.startDate,
      goalTargetDate: startOption.goalTargetDate,
      replaceActive: values.replaceActive,
      timezone,
    },
  };
}

export function toCreateInput(
  values: PlanWizardValues,
  startOption: PlanStartOption | null,
  timezone: string,
): CreateManualPlanInput {
  return {
    ...toPreviewInput(values, timezone),
    ...buildSaveFields(values, startOption, timezone),
  };
}

export function toRebuildInput(
  values: PlanWizardValues,
  target: RebuildTarget,
  startOption: PlanStartOption | null,
  timezone: string,
  expectedVersion?: number,
): RebuildInput {
  return {
    ...toRebuildPreviewInput(values, target, timezone),
    ...buildSaveFields(values, startOption, timezone),
    expectedVersion,
  };
}

// ------------------------------------------------------------------ validation

export function isGoalType(value: unknown): value is AthleteGoalType {
  return (
    typeof value === "string" &&
    (ATHLETE_GOAL_TYPES as readonly string[]).includes(value)
  );
}

export function isFocusType(value: string): value is PlanFocusType {
  return (PLAN_FOCUS_TYPES as readonly string[]).includes(value);
}

export function isRecentDistance(
  value: unknown,
): value is (typeof RECENT_RESULT_DISTANCES)[number] {
  return (
    typeof value === "string" &&
    (RECENT_RESULT_DISTANCES as readonly string[]).includes(value)
  );
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
