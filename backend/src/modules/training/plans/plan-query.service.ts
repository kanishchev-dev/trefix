import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AthletesService } from '../athletes/athletes.service';
import { CurrentWeekContextDto, PlanOverviewResponseDto, PlanWeekDto } from '../dto/plan-overview-response.dto';
import { AdaptationEvent } from '../entities/adaptation-event.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { AdaptationEventView, TrainingPlanView } from '../interfaces/training-views.interface';
import { ADAPTATION_TYPE_USER_EDIT } from '../training.constants';
import { toAdaptationEventView, toPlanView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { toGoalSummary } from './plan-presentation';

/** Days a completed plan is still shown as the current one. */
const CURRENT_PLAN_COMPLETED_GRACE_DAYS = 14;
const DAY_MS = 86_400_000;
/** Adaptations listed on the overview screen. */
const OVERVIEW_ADAPTATIONS_LIMIT = 10;
/** Workout types named as key sessions of a week. */
const KEY_SESSION_TYPES = ['interval', 'threshold', 'tempo', 'long_run'];
/** Id accepted by the overview endpoint for "the plan I am on". */
export const CURRENT_PLAN_ID = 'current';

const OVERVIEW_STATUS: Readonly<Record<string, 'not_started' | 'active' | 'completed' | 'cancelled'>> = {
  draft: 'not_started',
  active: 'active',
  completed: 'completed',
  paused: 'active',
  cancelled: 'cancelled',
};

/** Read side of training plans: plan views and the overview screen. */
@Injectable()
export class PlanQueryService {
  constructor(
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    private readonly lookup: TrainingLookupService,
    private readonly athletes: AthletesService,
    private readonly planLifecycle: PlanLifecycleService,
  ) {}

  /** Users who run an active (or paused) plan; for notification audiences. */
  async findUserIdsWithActivePlan(): Promise<Set<string>> {
    const plans = await this.planModel.findAll({
      where: { status: { [Op.in]: ['active', 'paused'] } },
      attributes: ['athleteId'],
    });
    return this.athletes.userIdsOf(plans.map((plan) => plan.athleteId));
  }

  /** A plan with its workouts; drafts have no workouts yet. */
  async planView(plan: TrainingPlan): Promise<TrainingPlanView> {
    const workouts = plan.status === 'draft' ? [] : await this.lookup.planWorkouts(plan.id);
    return toPlanView(plan, workouts);
  }

  /** Returns a training plan with its scheduled workouts. */
  async getPlan(id: string, actorUserId: string): Promise<TrainingPlanView> {
    const plan = await this.lookup.plan(id);
    await this.lookup.ownedAthlete(plan.athleteId, actorUserId);
    return toPlanView(plan, await this.lookup.planWorkouts(plan.id));
  }

  /**
   * The plan that is actually running for the authenticated athlete — what
   * the coach and the AI must reason about, not merely the latest created one.
   */
  async getActivePlanForAthlete(athleteId: string, actorUserId: string): Promise<TrainingPlanView | null> {
    await this.lookup.ownedAthlete(athleteId, actorUserId);
    const plan = await this.lookup.activePlan(athleteId);
    return plan ? toPlanView(plan, await this.lookup.planWorkouts(plan.id)) : null;
  }

  /** Latest edits the user made to a plan; context for the coach. */
  async listRecentUserEdits(planId: string, limit = 5): Promise<AdaptationEventView[]> {
    const events = await this.adaptationEventModel.findAll({
      where: { planId, type: ADAPTATION_TYPE_USER_EDIT },
      order: [['createdAt', 'DESC']],
      limit,
    });
    return events.map((event) => toAdaptationEventView(event));
  }

  /** Everything the plan screen shows: weeks with progress, current week focus, recent adaptations. */
  async getPlanOverview(id: string, actorUserId: string): Promise<PlanOverviewResponseDto> {
    const plan = id === CURRENT_PLAN_ID ? await this.findCurrentPlan(actorUserId) : await this.lookup.plan(id);
    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }
    await this.lookup.ownedAthlete(plan.athleteId, actorUserId);
    await this.planLifecycle.completeIfEnded(plan);

    const goal = plan.goalId ? await this.lookup.goal(plan.goalId) : null;
    const workouts = await this.lookup.planWorkouts(plan.id);
    const adaptations = await this.adaptationEventModel.findAll({
      where: { planId: plan.id },
      order: [['createdAt', 'DESC']],
      limit: OVERVIEW_ADAPTATIONS_LIMIT,
    });

    const currentWeekNumber = this.currentWeekNumber(plan);
    const weeks: PlanWeekDto[] = plan.weeks.map((week: Record<string, unknown>) => {
      const weekNumber = Number(week.weekNumber);
      const weekWorkouts = workouts.filter((workout) => workout.weekNumber === weekNumber);
      const totalDistance = weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
      const phase = String(week.phase ?? 'base');

      return {
        id: `week-${plan.id}-${weekNumber}`,
        weekNumber,
        phase: phase.toUpperCase(),
        status: this.weekStatus(weekNumber, currentWeekNumber),
        plannedWorkoutsCount: weekWorkouts.length,
        plannedDistance: Math.round(totalDistance),
        plannedLoad: Math.round(Number(week.weeklyLoadTarget ?? 0)),
        keySessions: weekWorkouts
          .filter((workout) => KEY_SESSION_TYPES.includes(workout.type))
          .map((workout) => ({ type: workout.type, distanceKm: Math.round(workout.distanceKm) })),
      };
    });

    const currentPhase = weeks.find((week) => week.status === 'current')?.phase || weeks[0]?.phase || 'BASE';
    const currentWeek = currentWeekNumber > 0 ? weeks[currentWeekNumber - 1] : undefined;
    const currentWeekContext: CurrentWeekContextDto | undefined = currentWeek
      ? { weekNumber: currentWeek.weekNumber, phase: currentWeek.phase, keySessions: currentWeek.keySessions }
      : undefined;

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        goal: toGoalSummary(goal),
        status: OVERVIEW_STATUS[plan.status] || 'active',
        currentWeek: currentWeekNumber,
        totalWeeks: plan.weeks.length,
        progress: currentWeekNumber > 0 ? currentWeekNumber / plan.weeks.length : 0,
        currentPhase,
        startDate: plan.startDate ?? undefined,
        notes: plan.notes,
        version: plan.version,
        config: { ...plan.config },
      },
      weeks,
      currentWeekContext,
      adaptations: adaptations.map((adaptation) => ({
        id: adaptation.id,
        weekNumber: workouts.find((workout) => workout.id === adaptation.workoutId)?.weekNumber,
        type: adaptation.type,
        reason: adaptation.reason,
        createdAt: adaptation.createdAt.toISOString(),
      })),
    };
  }

  /**
   * The active plan, or a recently completed one so the user still sees the
   * result; drafts and cancelled plans are never current.
   */
  private async findCurrentPlan(actorUserId: string): Promise<TrainingPlan | null> {
    const athleteId = (await this.athletes.getOrCreateAthlete(actorUserId)).id;
    const active = await this.lookup.activePlan(athleteId);
    if (active) {
      return active;
    }
    const graceStart = new Date(Date.now() - CURRENT_PLAN_COMPLETED_GRACE_DAYS * DAY_MS).toISOString().slice(0, 10);
    return this.planModel.findOne({
      where: { athleteId, status: 'completed', endDate: { [Op.gte]: graceStart } },
      order: [['endDate', 'DESC']],
    });
  }

  /** 1-based week the plan is in today; 0 before the start. */
  private currentWeekNumber(plan: TrainingPlan): number {
    const startDate = plan.startDate ? new Date(plan.startDate) : new Date();
    const now = new Date();
    if (now < startDate) {
      return 0;
    }
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / DAY_MS);
    return Math.max(1, Math.min(plan.weeks.length, Math.floor(elapsedDays / 7) + 1));
  }

  private weekStatus(weekNumber: number, currentWeekNumber: number): 'completed' | 'current' | 'upcoming' {
    if (currentWeekNumber === 0 || weekNumber > currentWeekNumber) {
      return 'upcoming';
    }
    return weekNumber < currentWeekNumber ? 'completed' : 'current';
  }
}
