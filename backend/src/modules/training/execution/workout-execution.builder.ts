import { Injectable } from '@nestjs/common';

import type { WorkoutView } from '../interfaces/training-views.interface';
import { WORKOUT_GOALS, type WorkoutGoal } from '../training.constants';
import { goalPaceCorridor } from '../workouts/workout-goal';

export const EXECUTION_STEP_KINDS = ['warmup', 'work', 'recovery', 'steady', 'cooldown'] as const;
export type ExecutionStepKind = (typeof EXECUTION_STEP_KINDS)[number];

export interface ExecutionTargetPace {
  minSecPerKm: number;
  maxSecPerKm: number;
}

/** One step the tracker leads the athlete through. */
export interface ExecutionStep {
  index: number;
  kind: ExecutionStepKind;
  durationSec: number | null;
  distanceM: number | null;
  targetPace: ExecutionTargetPace | null;
  zone: string | null;
  /** Position inside a block of repeats, e.g. work 2 of 5. */
  repetition: { index: number; total: number } | null;
}

export interface WorkoutExecution {
  workoutId: string;
  type: WorkoutView['type'];
  steps: ExecutionStep[];
  totalDurationSec: number;
  totalDistanceM: number | null;
}

/** Shortest rest between repeats, seconds. */
const MIN_REPEAT_REST_SEC = 60;
/** Types whose main block is quality work rather than steady running. */
const QUALITY_TYPES: ReadonlySet<string> = new Set(['tempo', 'threshold', 'interval', 'hill']);

type RawStep = Record<string, unknown>;
type DraftStep = Omit<ExecutionStep, 'index'>;

/**
 * Turns the coarse `steps` of a planned workout (warmup / main block with
 * repetitions / recovery / cooldown, minutes) into the ordered sequence the
 * tracker announces: every repeat and every rest between repeats is its own step.
 */
@Injectable()
export class WorkoutExecutionBuilder {
  build(
    workout: Pick<WorkoutView, 'id' | 'type' | 'durationMinutes' | 'distanceKm' | 'target' | 'steps'>,
  ): WorkoutExecution {
    const goal = goalOf(workout.target);
    const drafts =
      goal !== null
        ? this.goalSteps(workout, goal)
        : workout.type === 'race'
          ? this.raceSteps(workout)
          : this.planSteps(workout);
    const steps = drafts.map((step, index) => ({ ...step, index }));
    const totalDurationSec = steps.reduce((sum, step) => sum + (step.durationSec ?? 0), 0);
    const distances = steps.map((step) => step.distanceM);
    const totalDistanceM = distances.every((value) => value !== null)
      ? distances.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
    return { workoutId: workout.id, type: workout.type, steps, totalDurationSec, totalDistanceM };
  }

  /**
   * A workout the athlete added with one goal runs as one step: the time, or the
   * distance (with the pace corridor when it has a time limit). Without a goal
   * there is nothing to lead through, so there are no steps.
   */
  private goalSteps(
    workout: Pick<WorkoutView, 'type' | 'durationMinutes' | 'distanceKm' | 'target'>,
    goal: WorkoutGoal,
  ): DraftStep[] {
    const kind: ExecutionStepKind = QUALITY_TYPES.has(workout.type) ? 'work' : 'steady';
    if (goal === 'duration' && workout.durationMinutes > 0) {
      return [
        {
          kind,
          durationSec: minutesToSec(workout.durationMinutes),
          distanceM: null,
          targetPace: null,
          zone: null,
          repetition: null,
        },
      ];
    }
    if (goal === 'distance' && workout.distanceKm > 0) {
      const timeLimitMin = numberOf(workout.target?.timeLimitMin);
      return [
        {
          kind,
          durationSec: null,
          distanceM: Math.round(workout.distanceKm * 1000),
          targetPace: timeLimitMin !== null ? goalPaceCorridor(workout.distanceKm, timeLimitMin) : null,
          zone: null,
          repetition: null,
        },
      ];
    }
    return [];
  }

  private raceSteps(workout: Pick<WorkoutView, 'durationMinutes' | 'distanceKm'>): DraftStep[] {
    return [
      {
        kind: 'steady',
        durationSec: workout.distanceKm > 0 ? null : minutesToSec(workout.durationMinutes),
        distanceM: workout.distanceKm > 0 ? Math.round(workout.distanceKm * 1000) : null,
        targetPace: null,
        zone: null,
        repetition: null,
      },
    ];
  }

  private planSteps(workout: Pick<WorkoutView, 'type' | 'durationMinutes' | 'target' | 'steps'>): DraftStep[] {
    const raw = (workout.steps ?? []).filter((step) => step.type !== 'rest');
    const mainIndex = this.mainStepIndex(raw);
    if (mainIndex === -1) {
      return [this.steadyStep(minutesToSec(workout.durationMinutes), workout.target, workout.type)];
    }

    const main = raw[mainIndex]!;
    const repetitions = Math.max(1, Math.round(numberOf(main.repetitions) ?? 1));
    // The recovery block right after a repeated main block is the rest between repeats.
    const restIndex =
      repetitions > 1 && raw[mainIndex + 1]?.type === 'recovery' && !raw[mainIndex + 1]?.target ? mainIndex + 1 : -1;
    const restTotalSec = restIndex === -1 ? 0 : minutesToSec(numberOf(raw[restIndex]!.durationMinutes) ?? 0);

    const result: DraftStep[] = [];
    raw.forEach((step, index) => {
      if (index === restIndex) return;
      if (index !== mainIndex) {
        result.push(this.supportStep(step));
        return;
      }
      const target = (step.target as Record<string, unknown> | undefined) ?? workout.target;
      const mainSec = minutesToSec(numberOf(step.durationMinutes) ?? workout.durationMinutes);
      if (repetitions === 1) {
        result.push(this.steadyStep(mainSec, target, workout.type));
        return;
      }
      const workSec = Math.round(mainSec / repetitions);
      const restSec = Math.max(MIN_REPEAT_REST_SEC, Math.round(restTotalSec / (repetitions - 1)));
      for (let repeat = 1; repeat <= repetitions; repeat += 1) {
        result.push({
          kind: 'work',
          durationSec: workSec,
          distanceM: null,
          ...paceOf(target),
          repetition: { index: repeat, total: repetitions },
        });
        if (repeat < repetitions) {
          result.push({
            kind: 'recovery',
            durationSec: restSec,
            distanceM: null,
            targetPace: null,
            zone: null,
            repetition: { index: repeat, total: repetitions - 1 },
          });
        }
      }
    });
    return result;
  }

  /** The main block carries the pace target; warmup, cooldown and plain recovery never do. */
  private mainStepIndex(steps: RawStep[]): number {
    const withTarget = steps.findIndex((step) => step.target && step.type !== 'warmup' && step.type !== 'cooldown');
    if (withTarget !== -1) return withTarget;
    return steps.findIndex((step) => step.type !== 'warmup' && step.type !== 'cooldown' && step.type !== 'recovery');
  }

  private supportStep(step: RawStep): DraftStep {
    const kind: ExecutionStepKind =
      step.type === 'warmup' ? 'warmup' : step.type === 'cooldown' ? 'cooldown' : 'recovery';
    return {
      kind,
      durationSec: minutesToSec(numberOf(step.durationMinutes) ?? 0),
      distanceM: null,
      targetPace: null,
      zone: null,
      repetition: null,
    };
  }

  private steadyStep(durationSec: number, target: Record<string, unknown> | undefined, type: string): DraftStep {
    return {
      kind: QUALITY_TYPES.has(type) ? 'work' : 'steady',
      durationSec,
      distanceM: null,
      ...paceOf(target),
      repetition: null,
    };
  }
}

function goalOf(target: Record<string, unknown> | undefined | null): WorkoutGoal | null {
  const goal = target?.goal;
  return typeof goal === 'string' && (WORKOUT_GOALS as readonly string[]).includes(goal) ? (goal as WorkoutGoal) : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function minutesToSec(minutes: number): number {
  return Math.max(0, Math.round(minutes * 60));
}

function paceOf(target: Record<string, unknown> | undefined): Pick<DraftStep, 'targetPace' | 'zone'> {
  const min = numberOf(target?.paceMinSecondsPerKm);
  const max = numberOf(target?.paceMaxSecondsPerKm);
  return {
    targetPace:
      min !== null && max !== null ? { minSecPerKm: Math.min(min, max), maxSecPerKm: Math.max(min, max) } : null,
    zone: typeof target?.zone === 'string' ? target.zone : null,
  };
}
