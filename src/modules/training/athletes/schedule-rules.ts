import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import type { AthleteExperienceLevel } from '../training.constants';

export interface ScheduleState {
  experienceLevel: AthleteExperienceLevel;
  availableTrainingDays: string[];
  sessionsPerWeek: number;
  allowDoubles: boolean;
}

/** Which schedule fields the request set explicitly; implicit consequences are corrected, explicit ones rejected. */
export interface ScheduleRequest {
  sessionsPerWeek: boolean;
  allowDoubles: boolean;
}

export const MAX_SESSIONS_PER_WEEK = 7;

/** Two workouts a day are allowed only for advanced athletes. */
export function canDoubleUp(level: AthleteExperienceLevel): boolean {
  return level === 'advanced';
}

/** Upper bound of sessions: one per available day, or two per day (capped at 7) with doubles. */
export function maxSessionsPerWeek(days: number, allowDoubles: boolean): number {
  return Math.min(MAX_SESSIONS_PER_WEEK, allowDoubles ? days * 2 : days);
}

/**
 * Brings the schedule in line with the rules. A value the user sent that breaks
 * them is a 400; a value that became invalid because of another change (a day
 * removed, the level lowered) is corrected silently — the client sees the
 * corrected profile in the response.
 */
export function reconcileSchedule(state: ScheduleState, request: ScheduleRequest): ScheduleState {
  const next = { ...state };

  if (next.allowDoubles && !canDoubleUp(next.experienceLevel)) {
    if (request.allowDoubles) {
      throw new DomainBadRequestException(
        'ATHLETE_DOUBLES_NOT_ALLOWED',
        'Two workouts a day are available only for advanced athletes',
      );
    }
    next.allowDoubles = false;
  }

  const max = maxSessionsPerWeek(next.availableTrainingDays.length, next.allowDoubles);
  if (next.sessionsPerWeek > max) {
    if (request.sessionsPerWeek) {
      throw new DomainBadRequestException(
        'ATHLETE_SESSIONS_EXCEED_DAYS',
        `sessionsPerWeek cannot exceed ${max} for the selected days`,
        { fields: [{ field: 'sessionsPerWeek', min: 1, max }] },
      );
    }
    next.sessionsPerWeek = Math.max(1, max);
  }
  return next;
}
