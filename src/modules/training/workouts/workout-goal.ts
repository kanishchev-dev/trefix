import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import type { CreateWorkoutDto } from '../dto/create-workout.dto';
import { WORKOUT_GOAL_PACE_CORRIDOR_SEC, type WorkoutGoal } from '../training.constants';

export const WORKOUT_GOAL_ERROR_CODE = 'INVALID_GOAL';

/** Volume and target fields of a workout created with an explicit goal. */
export interface WorkoutGoalVolume {
  durationMinutes: number;
  distanceKm: number;
  target: { goal: WorkoutGoal; timeLimitMin?: number };
}

/**
 * Keeps only what the athlete set: the goal value goes to its column, the other
 * column stays 0 instead of an estimate. A distance goal with a time limit
 * stores the limit as the duration so the plan and analysis see both.
 * Returns null for requests without a goal (older clients, imports).
 */
export function resolveWorkoutGoal(
  dto: Pick<CreateWorkoutDto, 'goal' | 'durationMinutes' | 'distanceKm' | 'timeLimitMin'>,
): WorkoutGoalVolume | null {
  if (dto.goal === undefined) {
    if (dto.timeLimitMin !== undefined) {
      throw new DomainBadRequestException(WORKOUT_GOAL_ERROR_CODE, 'A time limit needs a distance goal');
    }
    return null;
  }
  if (dto.timeLimitMin !== undefined && dto.goal !== 'distance') {
    throw new DomainBadRequestException(WORKOUT_GOAL_ERROR_CODE, 'A time limit needs a distance goal');
  }
  if (dto.goal === 'duration') {
    if (!dto.durationMinutes || dto.durationMinutes <= 0) {
      throw new DomainBadRequestException(WORKOUT_GOAL_ERROR_CODE, 'A duration goal needs durationMinutes');
    }
    return { durationMinutes: dto.durationMinutes, distanceKm: 0, target: { goal: 'duration' } };
  }
  if (dto.goal === 'distance') {
    if (!dto.distanceKm || dto.distanceKm <= 0) {
      throw new DomainBadRequestException(WORKOUT_GOAL_ERROR_CODE, 'A distance goal needs distanceKm');
    }
    return {
      durationMinutes: dto.timeLimitMin ?? 0,
      distanceKm: dto.distanceKm,
      target: {
        goal: 'distance',
        ...(dto.timeLimitMin !== undefined ? { timeLimitMin: dto.timeLimitMin } : {}),
      },
    };
  }
  return { durationMinutes: 0, distanceKm: 0, target: { goal: 'none' } };
}

/** Target pace of a distance goal with a time limit: the even pace ± the corridor. */
export function goalPaceCorridor(
  distanceKm: number,
  timeLimitMin: number,
): { minSecPerKm: number; maxSecPerKm: number } | null {
  if (!(distanceKm > 0) || !(timeLimitMin > 0)) {
    return null;
  }
  const pace = Math.round((timeLimitMin * 60) / distanceKm);
  return {
    minSecPerKm: Math.max(1, pace - WORKOUT_GOAL_PACE_CORRIDOR_SEC),
    maxSecPerKm: pace + WORKOUT_GOAL_PACE_CORRIDOR_SEC,
  };
}
