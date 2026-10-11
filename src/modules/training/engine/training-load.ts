import { AthleteView, GoalView, WorkoutAnalysisView, WorkoutView } from '../interfaces/training-views.interface';
import { TRAINING_DEFAULT_TARGET_CONFIDENCE, TRAINING_STATE_SOURCE } from '../training.constants';
import { TrainingStateComputation, WorkoutAnalysisInput, WorkoutAnalysisResult } from './engine.types';
import { clamp, resolveIntensityFactor, sumLoadWithin } from './engine-utils';
import {
  estimateVo2maxFromThresholdPace,
  resolveActualPace,
  resolveTargetPace,
  resolveThresholdHeartRate,
  resolveThresholdPace,
} from './pace-model';

/*
 * Training load, the fitness/fatigue state derived from it, and analysis of a completed workout.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

export function calculateTrainingState(
  athlete: AthleteView,
  recentLoads: Array<{ load: number; occurredAt: Date }>,
  goal: GoalView | null,
): TrainingStateComputation {
  const sortedLoads = [...recentLoads].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  const now = new Date();

  const acuteLoad = sumLoadWithin(sortedLoads, now, 7);
  const chronicLoad = sumLoadWithin(sortedLoads, now, 42) / 6;
  const weeklyLoad = acuteLoad;
  const fitness = chronicLoad;
  const fatigue = acuteLoad;
  const form = fitness - fatigue;
  const recoveryScore = clamp(100 - fatigue + form * 0.5, 0, 100);

  const thresholdPaceSecondsPerKm = resolveThresholdPace(athlete, goal);
  const thresholdHeartRate = resolveThresholdHeartRate(athlete, goal);
  const vo2max = thresholdPaceSecondsPerKm ? estimateVo2maxFromThresholdPace(thresholdPaceSecondsPerKm) : null;

  const confidence = resolveConfidence(athlete, sortedLoads.length, thresholdPaceSecondsPerKm);

  return {
    fitness,
    fatigue,
    form,
    weeklyLoad,
    acuteLoad,
    chronicLoad,
    recoveryScore,
    thresholdPaceSecondsPerKm,
    thresholdHeartRate,
    vo2max,
    confidence,
    source: TRAINING_STATE_SOURCE,
  };
}

export function calculateTrainingLoad(
  workout: WorkoutView,
  actual?: WorkoutAnalysisView,
): { load: number; intensityFactor: number } {
  const intensityFactor = resolveIntensityFactor(workout.type);
  const durationMinutes = actual ? workout.durationMinutes * actual.completion : workout.durationMinutes;
  const completionFactor = actual ? clamp(actual.completion, 0.5, 1.5) : 1;
  const load = Math.round(durationMinutes * intensityFactor * completionFactor);

  return { load, intensityFactor };
}

export function analyzeWorkout(input: WorkoutAnalysisInput): WorkoutAnalysisResult {
  const planned = input.plannedWorkout;
  const durationRatio = input.actualDurationMinutes / Math.max(planned.durationMinutes, 1);
  const distanceRatio = input.actualDistanceKm / Math.max(planned.distanceKm, 0.1);
  const completion = clamp((durationRatio + distanceRatio) / 2, 0, 1.5);
  const paceBaseline = resolveTargetPace(planned);
  const actualPace =
    input.actualAveragePaceSecondsPerKm ?? resolveActualPace(input.actualDurationMinutes, input.actualDistanceKm);
  const performanceDelta = paceBaseline && actualPace ? clamp((paceBaseline - actualPace) / paceBaseline, -1, 1) : 0;

  const fatigueImpact = resolveFatigueImpact(completion, performanceDelta, input.rpe);
  const actualView: WorkoutAnalysisView = {
    completion,
    performanceDelta,
    load: 0,
    expectedLoad: 0,
    fatigueImpact,
    confidence: resolveAnalysisConfidence(completion, performanceDelta, input),
    analysisVersion: 'analysis-v1',
  };
  const loadResult = calculateTrainingLoad(planned, actualView);

  return {
    analysis: {
      ...actualView,
      load: loadResult.load,
      expectedLoad: Math.round(planned.durationMinutes * resolveIntensityFactor(planned.type)),
    },
    trainingLoad: loadResult.load,
    intensityFactor: loadResult.intensityFactor,
    fatigueImpact,
  };
}

function resolveFatigueImpact(
  completion: number,
  performanceDelta: number,
  rpe?: number,
): WorkoutAnalysisView['fatigueImpact'] {
  if (completion < 0.8 || performanceDelta < -0.12 || (typeof rpe === 'number' && rpe >= 8)) {
    return 'high';
  }

  if (completion < 0.95 || performanceDelta < -0.03 || (typeof rpe === 'number' && rpe >= 6)) {
    return 'moderate';
  }

  return 'low';
}

function resolveAnalysisConfidence(completion: number, performanceDelta: number, input: WorkoutAnalysisInput): number {
  const hasHeartRate = typeof input.actualAverageHeartRate === 'number';
  const hasPace = typeof input.actualAveragePaceSecondsPerKm === 'number';
  const confidence = 0.55 + Math.min(0.2, completion * 0.1) + Math.min(0.15, Math.abs(performanceDelta) * 0.2);
  return clamp(confidence + (hasHeartRate ? 0.05 : 0) + (hasPace ? 0.05 : 0), 0, 1);
}

function resolveConfidence(athlete: AthleteView, loadCount: number, thresholdPaceSecondsPerKm: number | null): number {
  const base = TRAINING_DEFAULT_TARGET_CONFIDENCE + Math.min(0.2, loadCount / 100);
  const paceBonus = thresholdPaceSecondsPerKm ? 0.08 : 0;
  const profileBonus = athlete.recentRaceResults.length > 0 ? 0.1 : 0;
  return clamp(base + paceBonus + profileBonus, 0, 1);
}
