import type { ExecutionStep, RecordedLap } from "@workspace/api-client";

/** Seconds of slack around the target pace before the runner is off target. */
export const PACE_TOLERANCE_SEC = 5;

export type PaceStatus = "in" | "fast" | "slow";

/** Progress through the steps of a planned workout; plain JSON, part of the engine snapshot. */
export type PlanState = {
  steps: ExecutionStep[];
  /** Index of the running step; `steps.length` once every step is done. */
  current: number;
  stepStartMs: number;
  stepStartM: number;
  laps: RecordedLap[];
};

export type StepProgress = {
  step: ExecutionStep;
  index: number;
  total: number;
  /** Left of a time-based step, seconds. */
  remainingSec: number | null;
  /** Left of a distance-based step, metres. */
  remainingM: number | null;
  fraction: number;
  next: ExecutionStep | null;
};

export function startPlan(steps: ExecutionStep[], movingMs: number, distanceM: number): PlanState {
  return { steps, current: 0, stepStartMs: movingMs, stepStartM: distanceM, laps: [] };
}

function stepDone(step: ExecutionStep, elapsedMs: number, coveredM: number): boolean {
  if (step.durationSec !== null) return elapsedMs >= step.durationSec * 1000;
  if (step.distanceM !== null) return coveredM >= step.distanceM;
  return false;
}

function lapOf(plan: PlanState, step: ExecutionStep, endMs: number, endM: number): RecordedLap {
  const actualSec = Math.round((endMs - plan.stepStartMs) / 1000);
  const actualM = Math.round(endM - plan.stepStartM);
  const avgPace = actualM >= 50 ? Math.round((actualSec / actualM) * 1000) : null;
  const target = step.targetPace;
  return {
    index: step.index,
    kind: step.kind,
    plannedSec: step.durationSec,
    plannedM: step.distanceM,
    actualSec,
    actualM,
    avgPaceSecPerKm: avgPace,
    inTarget:
      target && avgPace !== null
        ? avgPace >= target.minSecPerKm - PACE_TOLERANCE_SEC && avgPace <= target.maxSecPerKm + PACE_TOLERANCE_SEC
        : null,
  };
}

/**
 * Moves to the next step when the running one is complete. A time step ends
 * exactly at its duration; the overshoot of that tick goes to the next step.
 * Returns the indexes of the steps that started.
 */
export function advancePlan(plan: PlanState, movingMs: number, distanceM: number): number[] {
  const started: number[] = [];
  while (plan.current < plan.steps.length) {
    const step = plan.steps[plan.current]!;
    if (!stepDone(step, movingMs - plan.stepStartMs, distanceM - plan.stepStartM)) break;
    const endMs = step.durationSec !== null ? plan.stepStartMs + step.durationSec * 1000 : movingMs;
    const endM = step.distanceM !== null ? plan.stepStartM + step.distanceM : distanceM;
    plan.laps.push(lapOf(plan, step, Math.min(endMs, movingMs), Math.min(endM, distanceM)));
    plan.current += 1;
    plan.stepStartMs = Math.min(endMs, movingMs);
    plan.stepStartM = Math.min(endM, distanceM);
    if (plan.current < plan.steps.length) started.push(plan.current);
  }
  return started;
}

/** The runner ends the running step early ("next step"). */
export function skipStep(plan: PlanState, movingMs: number, distanceM: number): number | null {
  if (plan.current >= plan.steps.length) return null;
  plan.laps.push(lapOf(plan, plan.steps[plan.current]!, movingMs, distanceM));
  plan.current += 1;
  plan.stepStartMs = movingMs;
  plan.stepStartM = distanceM;
  return plan.current < plan.steps.length ? plan.current : null;
}

/** Closes the unfinished step at the end of the run, when something was run in it. */
export function closePlan(plan: PlanState, movingMs: number, distanceM: number): void {
  if (plan.current >= plan.steps.length) return;
  if (movingMs - plan.stepStartMs >= 1000) {
    plan.laps.push(lapOf(plan, plan.steps[plan.current]!, movingMs, distanceM));
  }
  plan.current = plan.steps.length;
}

export function stepProgress(plan: PlanState, movingMs: number, distanceM: number): StepProgress | null {
  const step = plan.steps[plan.current];
  if (!step) return null;
  const elapsedMs = movingMs - plan.stepStartMs;
  const coveredM = distanceM - plan.stepStartM;
  const remainingSec = step.durationSec !== null ? Math.max(0, Math.ceil(step.durationSec - elapsedMs / 1000)) : null;
  const remainingM = step.distanceM !== null ? Math.max(0, Math.round(step.distanceM - coveredM)) : null;
  const fraction =
    step.durationSec !== null
      ? Math.min(1, elapsedMs / (step.durationSec * 1000))
      : step.distanceM !== null
        ? Math.min(1, coveredM / step.distanceM)
        : 0;
  return {
    step,
    index: plan.current,
    total: plan.steps.length,
    remainingSec,
    remainingM,
    fraction,
    next: plan.steps[plan.current + 1] ?? null,
  };
}

export function paceStatus(step: ExecutionStep, paceSecPerKm: number | null): PaceStatus | null {
  const target = step.targetPace;
  if (!target || paceSecPerKm === null) return null;
  if (paceSecPerKm < target.minSecPerKm - PACE_TOLERANCE_SEC) return "fast";
  if (paceSecPerKm > target.maxSecPerKm + PACE_TOLERANCE_SEC) return "slow";
  return "in";
}
