import { ManualPlanPreviewResponseDto, ManualPlanPreviewWeekDto } from '../dto/manual-plan-preview-response.dto';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { GoalView } from '../interfaces/training-views.interface';
import { PlanBuildResult } from '../training.engine';
import { mondayIndex } from './plan-utils';

/*
 * Texts and shapes of plan screens: week titles, intents, the manual plan
 * preview. Pure functions over engine output; no persistence.
 */

const WEEK_TITLES: Readonly<Record<string, string>> = {
  base: 'Building consistency',
  build: 'Increasing training load',
  specific: 'Race-specific work',
  peak: 'Peak preparation',
  taper: 'Reducing load',
  race: 'Race week',
  recovery: 'Volume recovery',
};

const WEEK_INTENTS: Readonly<Record<string, string>> = {
  base: 'Establish steady running routine and comfortable easy effort aerobic base.',
  build: 'Build aerobic strength while maintaining recovery between quality sessions.',
  specific: 'Develop target race pace efficiency and rhythm.',
  peak: 'Execute final key race simulation session before reducing volume.',
  taper: 'Shed residual fatigue while preserving neural sharpness.',
  race: 'Rest, hydrate, carb load and execute your goal race.',
  recovery: 'Allow body to adapt to previous load while maintaining frequency.',
};
const DEFAULT_WEEK_INTENT = 'Focus on consistent training and proper recovery.';

const ADAPTATION_TITLES: Readonly<Record<string, string>> = {
  ADD_RECOVERY: 'Recovery added',
  REDUCE_INTENSITY: 'Intensity reduced',
  REDUCE_VOLUME: 'Volume reduced',
  MOVE: 'Workout moved',
  REPLACE: 'Workout replaced',
  REGENERATE_PLAN: 'Plan adjusted',
};
const DEFAULT_ADAPTATION_TITLE = 'Plan adaptation';

export function weekTitle(phase: string, weekNumber: number): string {
  return WEEK_TITLES[phase.toLowerCase()] ?? `Week ${weekNumber} focus`;
}

export function weekIntent(phase: string): string {
  return WEEK_INTENTS[phase.toLowerCase()] ?? DEFAULT_WEEK_INTENT;
}

export function adaptationTitle(type: string): string {
  return ADAPTATION_TITLES[type] ?? DEFAULT_ADAPTATION_TITLE;
}

/**
 * Goal summary of the plan overview. Universal goals must not assume a race:
 * the summary follows the goal type, custom goals keep the user's text.
 */
export function overviewGoalTitle(goal: GoalView | AthleteGoal): string {
  if (goal.type === 'custom' && goal.payload?.description) {
    return goal.payload.description;
  }

  const target = goal.payload?.target ?? {};
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = Math.abs(Math.round(secs % 60));
    return `${mins}:${String(s).padStart(2, '0')}`;
  };

  const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
  const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
  if (distanceMeters) {
    const distanceKm = Math.round(distanceMeters / 100) / 10;
    return finishTimeSec ? `${distanceKm} km · ${formatTime(finishTimeSec)}` : `${distanceKm} km goal`;
  }

  const runsPerWeek = typeof target.runsPerWeek === 'number' ? target.runsPerWeek : null;
  if (runsPerWeek) {
    return `${runsPerWeek} runs/week`;
  }

  const weightKg = typeof target.weightKg === 'number' ? target.weightKg : null;
  if (weightKg) {
    return `${weightKg} kg goal`;
  }

  return goal.type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
      title: weekTitle(phase, weekNumber),
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
