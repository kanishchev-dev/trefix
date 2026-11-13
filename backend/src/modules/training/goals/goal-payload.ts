import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import { PreviewManualPlanDto } from '../dto/create-manual-plan.dto';
import {
  deriveLegacyRaceFields,
  type GoalPayloadShape,
  mapLegacyRaceGoal,
  validateGoalPayload,
} from '../goal-taxonomy';
import { GoalView } from '../interfaces/training-views.interface';
import { ATHLETE_GOAL_STATUSES } from '../training.constants';

/** The parts of a manual plan configuration the engine generates from. */
export type ManualPlanConfigInput = Pick<PreviewManualPlanDto, 'goal' | 'schedule' | 'structure'>;

/** Horizon of a preview goal when the user picked no target date. */
const PREVIEW_GOAL_DEFAULT_HORIZON_DAYS = 84;
/** Priority of goals created from the plan wizard. */
export const DEFAULT_GOAL_PRIORITY = 5;
/** Id of the in-memory goal a preview is generated for; never persisted. */
const PREVIEW_GOAL_ID = 'preview-goal';

/** Validates the universal goal payload; the rules live in the goal taxonomy. */
export function assertGoalPayloadValid(goal: GoalPayloadShape): void {
  const result = validateGoalPayload(goal);
  if (result.valid) {
    return;
  }
  throw new DomainBadRequestException(
    `GOAL_${result.code}`,
    `Goal configuration invalid: ${result.code}${result.field ? ` (${result.field})` : ''}`,
  );
}

/**
 * Universal payload of a manual plan goal. Legacy flat race fields
 * (`raceDistance` / `targetTimeSeconds`) from older clients are mapped onto the
 * universal model; universal fields win when both are present.
 */
export function normalizeManualGoalPayload(
  dtoGoal: ManualPlanConfigInput['goal'],
): GoalPayloadShape & { targetDate?: string } {
  if (dtoGoal.type) {
    return {
      type: dtoGoal.type,
      current: dtoGoal.current ?? undefined,
      target: dtoGoal.target ?? undefined,
      description: dtoGoal.description ?? undefined,
      targetDate: dtoGoal.targetDate,
    };
  }

  const legacy = mapLegacyRaceGoal(dtoGoal.raceDistance ?? 'just_running', dtoGoal.targetTimeSeconds ?? null);
  return { type: legacy.type, target: legacy.target, targetDate: dtoGoal.targetDate };
}

/** In-memory goal for generating a manual plan or its preview; nothing is persisted. */
export function buildManualGoalView(athleteId: string, dto: ManualPlanConfigInput, now = new Date()): GoalView {
  const payload = normalizeManualGoalPayload(dto.goal);
  assertGoalPayloadValid(payload);
  const legacyFields = deriveLegacyRaceFields(payload);

  return {
    id: PREVIEW_GOAL_ID,
    athleteId,
    type: payload.type,
    payload: {
      current: payload.current ?? undefined,
      target: payload.target ?? {},
      description: payload.description ?? undefined,
    },
    raceDistance: legacyFields.raceDistance,
    targetTimeSeconds: legacyFields.targetTimeSeconds,
    targetDate: dto.goal.targetDate ?? addDaysToIsoDate(now, PREVIEW_GOAL_DEFAULT_HORIZON_DAYS),
    priority: DEFAULT_GOAL_PRIORITY,
    status: ATHLETE_GOAL_STATUSES[0],
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

function addDaysToIsoDate(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
