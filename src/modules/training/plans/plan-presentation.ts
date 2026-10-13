import { ManualPlanPreviewResponseDto, ManualPlanPreviewWeekDto } from '../dto/manual-plan-preview-response.dto';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { GoalView } from '../interfaces/training-views.interface';
import { PlanBuildResult } from '../training.engine';
import { mondayIndex } from './plan-utils';

/*
 * Shapes of plan screens: the goal summary and the manual plan preview.
 * No user-facing text: clients translate types, phases and goal targets.
 * Pure functions over engine output; no persistence.
 */

/** Numeric goal target the clients format in the app language. */
export interface GoalTargetSummary {
  distanceMeters: number | null;
  finishTimeSec: number | null;
  runsPerWeek: number | null;
  weightKg: number | null;
}

/**
 * Goal as plan screens show it. Only codes and numbers: the clients build the
 * text in the app language; `description` is the user's own text of a custom goal.
 */
export interface GoalSummary {
  type: string | null;
  target: GoalTargetSummary | null;
  description: string | null;
  targetDate: string | null;
}

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);

export function toGoalSummary(goal: GoalView | AthleteGoal | null | undefined): GoalSummary {
  if (!goal) {
    return { type: null, target: null, description: null, targetDate: null };
  }
  const target = (goal.payload?.target ?? {}) as Record<string, unknown>;
  const summary: GoalTargetSummary = {
    distanceMeters: numberOrNull(target.distanceMeters),
    finishTimeSec: numberOrNull(target.finishTimeSec),
    runsPerWeek: numberOrNull(target.runsPerWeek),
    weightKg: numberOrNull(target.weightKg),
  };
  const hasTarget = Object.values(summary).some((value) => value !== null);
  const description = goal.payload?.description;
  return {
    type: goal.type,
    target: hasTarget ? summary : null,
    description: typeof description === 'string' && description.length > 0 ? description : null,
    targetDate: goal.targetDate ?? null,
  };
}

/** Engine build result as the manual plan preview; workout ids are `{week}-{order}`. */
export function toManualPreview(generatedPlan: PlanBuildResult): ManualPlanPreviewResponseDto {
  const weeks: ManualPlanPreviewWeekDto[] = generatedPlan.weeks.map((week) => {
    const weekNumber = Number(week.weekNumber);
    const phase = String(week.phase || 'base');
    const weekWorkouts = generatedPlan.workouts.filter((workout) => workout.weekNumber === weekNumber);

    return {
      weekNumber,
      phase: phase.toUpperCase(),
      plannedWorkoutsCount: weekWorkouts.length,
      plannedDistance: Math.round(weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0)),
      plannedLoad: Math.round(Number(week.weeklyLoadTarget || 0)),
      workouts: weekWorkouts.map((workout) => ({
        id: `${workout.weekNumber}-${workout.orderInWeek}`,
        type: workout.type,
        phase: workout.phase,
        weekNumber: workout.weekNumber,
        dayOfWeek: mondayIndex(workout.scheduledAt),
        scheduledAt: workout.scheduledAt.toISOString().slice(0, 10),
        orderInWeek: workout.orderInWeek,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      })),
    };
  });

  return {
    startDate: generatedPlan.startDate,
    endDate: generatedPlan.endDate,
    totalWeeks: generatedPlan.weeks.length,
    trainingFrequency: generatedPlan.trainingFrequency,
    weeklyTargetKm: generatedPlan.weeklyTargetKm,
    weeks,
  };
}
