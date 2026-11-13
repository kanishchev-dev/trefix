import { clampManualWeeks, resolveWeekdayDate } from './engine/engine-utils';
import { estimateThresholdFromTarget, resolvePaceRangeFor, resolveThresholdFromMetrics } from './engine/pace-model';
import { adaptPlan } from './engine/plan-adaptation';
import { generatePlan, toRelativeWeeks } from './engine/plan-builder';
import { extractFinalVersion, materializeWeeks, remapSchedule } from './engine/plan-calendar';
import { diffPlans } from './engine/plan-diff';
import { resizeToTargetDate, retargetIntensity, scaleVolume } from './engine/plan-reshaping';
import { analyzeWorkout, calculateTrainingLoad, calculateTrainingState } from './engine/training-load';
import { createWorkoutBlueprint, rebuildWorkoutTarget, validateWorkoutOverride } from './engine/workout-prescription';

export * from './engine/engine.types';

/**
 * Deterministic training engine: plan generation, workout prescription, load
 * and state, adaptation decisions and plan transformations.
 *
 * A stateless facade over the pure functions in `engine/`, kept as an
 * injectable class so services depend on one engine and tests can stub it.
 */
export class TrainingEngine {
  readonly createWorkoutBlueprint = createWorkoutBlueprint;
  readonly calculateTrainingState = calculateTrainingState;
  readonly calculateTrainingLoad = calculateTrainingLoad;
  readonly analyzeWorkout = analyzeWorkout;
  readonly adaptPlan = adaptPlan;
  readonly generatePlan = generatePlan;
  readonly validateWorkoutOverride = validateWorkoutOverride;
  readonly toRelativeWeeks = toRelativeWeeks;
  readonly extractFinalVersion = extractFinalVersion;
  readonly materializeWeeks = materializeWeeks;
  readonly retargetIntensity = retargetIntensity;
  readonly scaleVolume = scaleVolume;
  readonly remapSchedule = remapSchedule;
  readonly resizeToTargetDate = resizeToTargetDate;
  readonly diffPlans = diffPlans;
  readonly rebuildWorkoutTarget = rebuildWorkoutTarget;
  readonly estimateThresholdFromTarget = estimateThresholdFromTarget;
  readonly resolveThresholdFromMetrics = resolveThresholdFromMetrics;
  readonly resolvePaceRangeFor = resolvePaceRangeFor;
  readonly resolveWeekdayDate = resolveWeekdayDate;
  readonly clampManualWeeks = clampManualWeeks;
}
