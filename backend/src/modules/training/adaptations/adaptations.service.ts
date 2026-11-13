import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { emitAfterCommit } from '@/common/utils/transaction-events.util';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { AthleteStateService } from '../athletes/athlete-state.service';
import { AthletesService } from '../athletes/athletes.service';
import { AdaptPlanDto } from '../dto/adapt-plan.dto';
import { AdaptationEvent } from '../entities/adaptation-event.entity';
import { Athlete } from '../entities/athlete.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import {
  PlanAdaptationDismissedEvent,
  PlanAdaptationProposedEvent,
  PlanAdaptedEvent,
} from '../events/plan-adapted.event';
import { AdaptationEventView, AthleteStateView, WorkoutAnalysisView } from '../interfaces/training-views.interface';
import { ADAPTATION_TYPE_HEART_RATE } from '../training.constants';
import { TrainingEngine } from '../training.engine';
import { TRAINING_EVENTS } from '../training.events';
import {
  toAdaptationEventView,
  toPlanWeeks,
  toRecord,
  toStateComputation,
  toWorkoutAnalysisView,
  toWorkoutView,
} from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { PlanAdaptationApplier } from './plan-adaptation-applier';

/** Where an adaptation request comes from; automatic ones follow the user's coach settings. */
export type AdaptationOrigin = 'automatic' | 'explicit';

/** Pending adaptations listed for the user's decision. */
const PENDING_ADAPTATIONS_LIMIT = 20;
const PENDING_STATUSES = ['proposed', 'suggested'];
/** Pseudo-action of a completion that leaves the plan unchanged. */
const KEEP_ACTION = 'KEEP';

/**
 * Plan adaptations: engine decisions after a workout, heart-rate target
 * updates after a zone change, and the user's decisions on proposals.
 *
 * Only the active plan adapts, and only workouts from today on: history and
 * drafts are never rewritten.
 */
@Injectable()
export class AdaptationsService {
  constructor(
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly athletes: AthletesService,
    private readonly athleteState: AthleteStateService,
    private readonly trainingEngine: TrainingEngine,
    private readonly applier: PlanAdaptationApplier,
    private readonly coachPolicy: CoachPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Adaptations of the active plan waiting for the user's decision (`proposed`) or shown as advice (`suggested`). */
  async listPendingAdaptations(actorUserId: string): Promise<AdaptationEventView[]> {
    const athlete = await this.athletes.getOrCreateAthlete(actorUserId);
    const plan = await this.lookup.activePlan(athlete.id);
    if (!plan) {
      return [];
    }
    const events = await this.adaptationEventModel.findAll({
      where: { planId: plan.id, status: { [Op.in]: PENDING_STATUSES } },
      order: [['createdAt', 'DESC']],
      limit: PENDING_ADAPTATIONS_LIMIT,
    });
    return events.map((event) => toAdaptationEventView(event));
  }

  /** Applies an explicit (or implicit, for the latest completed workout) adaptation request to the active plan. */
  async adaptPlan(actorUserId: string, dto: AdaptPlanDto): Promise<AdaptationEventView> {
    const plan = await this.lookup.plan(dto.planId);
    const athlete = await this.lookup.ownedAthlete(plan.athleteId, actorUserId);
    if (plan.status !== 'active') {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only the active plan can be adapted');
    }

    const state = await this.athleteState.latest(athlete.id);
    const workouts = await this.lookup.planWorkouts(plan.id);
    const workout = dto.workoutId
      ? await this.lookup.workout(dto.workoutId)
      : (workouts.find((entry) => entry.status === 'completed') ?? workouts[0]);
    if (!workout) {
      throw new EntityNotFoundException('Workout', dto.workoutId ?? plan.id);
    }

    // A workout without stored analysis is analysed as if run exactly as planned.
    const analysis = workout.analysis
      ? toWorkoutAnalysisView(toRecord(workout.analysis))
      : this.trainingEngine.analyzeWorkout({
          plannedWorkout: toWorkoutView(workout),
          actualDurationMinutes: workout.durationMinutes,
          actualDistanceKm: workout.distanceKm,
        }).analysis;

    return this.decideAndApply(athlete, workout, analysis, state, {
      forcedAction: dto.forcedAction,
      reasonOverride: dto.reason,
      origin: 'explicit',
    });
  }

  /**
   * Runs the engine's adaptation decision for a completed workout and applies,
   * proposes or only suggests it according to the origin and coach settings.
   */
  async decideAndApply(
    athlete: Athlete,
    workout: Workout,
    analysis: WorkoutAnalysisView,
    state: AthleteStateView,
    options: { forcedAction?: string; reasonOverride?: string; origin: AdaptationOrigin },
    transaction?: Transaction,
  ): Promise<AdaptationEventView> {
    const workoutPlan = workout.planId ? await this.lookup.plan(workout.planId, transaction) : null;
    const plan = workoutPlan?.status === 'active' ? workoutPlan : null;
    const upcomingWorkouts = plan ? await this.applier.upcomingAfter(plan, workout, transaction) : [];

    const decision = this.trainingEngine.adaptPlan(
      plan ? toPlanWeeks(plan.weeks) : [],
      upcomingWorkouts.map((entry) => toWorkoutView(entry)),
      toStateComputation(state),
      analysis,
      options.forcedAction,
    );
    const reason = options.reasonOverride ?? decision.reason;

    // Explicit requests (the user or the coach acting on the user's message) always apply.
    const policy =
      options.origin === 'automatic' && plan && decision.changes.length > 0
        ? await this.coachPolicy.automaticAdaptationPolicy(athlete.userId)
        : 'apply';
    if (policy === 'skip') {
      return this.noopAdaptation(athlete.id, workout);
    }
    if (policy === 'propose' || policy === 'suggest') {
      const pending = await this.adaptationEventModel.create(
        {
          athleteId: athlete.id,
          planId: plan?.id ?? null,
          workoutId: workout.id,
          type: decision.action,
          input: { state, analysis },
          decision: { action: decision.action, changes: decision.changes },
          reason,
          confidence: decision.confidence,
          status: policy === 'propose' ? 'proposed' : 'suggested',
        },
        { transaction },
      );
      this.emitProposed(athlete, plan?.id ?? null, pending, decision.action, decision.changes.length, transaction);
      return toAdaptationEventView(pending);
    }

    const changed = await this.applier.applyWorkoutChanges(
      upcomingWorkouts,
      athlete,
      plan,
      state,
      decision.changes,
      transaction,
    );
    if (plan && changed > 0) {
      await this.applier.bumpPlanVersion(plan.id, transaction);
    }

    const adaptationEvent = await this.adaptationEventModel.create(
      {
        athleteId: athlete.id,
        planId: plan?.id ?? null,
        workoutId: workout.id,
        type: decision.action,
        input: { state, analysis },
        decision: { action: decision.action, changes: decision.changes },
        reason,
        confidence: decision.confidence,
      },
      { transaction },
    );
    emitAfterCommit(
      this.eventEmitter,
      transaction,
      TRAINING_EVENTS.PLAN_ADAPTED,
      new PlanAdaptedEvent(athlete.id, plan?.id ?? workout.id, adaptationEvent.reason),
    );
    return toAdaptationEventView(adaptationEvent);
  }

  /** The adaptation already recorded for a workout, or a no-op one when nothing was decided. */
  async latestForWorkout(athlete: Athlete, workout: Workout): Promise<AdaptationEventView> {
    const adaptation = await this.adaptationEventModel.findOne({
      where: { workoutId: workout.id },
      order: [['createdAt', 'DESC']],
    });
    return adaptation ? toAdaptationEventView(adaptation) : this.noopAdaptation(athlete.id, workout);
  }

  /** Applies a proposed adaptation; workouts that already happened or changed status are left alone. */
  async applyProposedAdaptation(actorUserId: string, adaptationId: string): Promise<AdaptationEventView> {
    const { event, athlete, plan } = await this.loadPending(actorUserId, adaptationId, ['proposed']);
    const changes = Array.isArray(event.decision?.changes)
      ? (event.decision.changes as Array<Record<string, unknown>>)
      : [];
    const state = event.type === ADAPTATION_TYPE_HEART_RATE ? null : await this.athleteState.latest(athlete.id);

    await this.planModel.sequelize!.transaction(async (transaction) => {
      if (state === null) {
        await this.applier.applyHeartRateChanges(plan, changes, transaction);
      } else {
        const workouts = await this.workoutModel.findAll({
          where: {
            id: { [Op.in]: this.workoutIdsOf(changes) },
            planId: plan.id,
            status: 'planned',
            scheduledAt: { [Op.gte]: this.applier.startOfToday() },
          },
          transaction,
        });
        const changed = await this.applier.applyWorkoutChanges(workouts, athlete, plan, state, changes, transaction);
        if (changed > 0) {
          await this.applier.bumpPlanVersion(plan.id, transaction);
        }
      }
      event.status = 'applied';
      event.resolvedAt = new Date();
      await event.save({ transaction });
    });

    this.eventEmitter.emit(TRAINING_EVENTS.PLAN_ADAPTED, new PlanAdaptedEvent(athlete.id, plan.id, event.reason));
    return toAdaptationEventView(event);
  }

  async dismissProposedAdaptation(actorUserId: string, adaptationId: string): Promise<AdaptationEventView> {
    const { event } = await this.loadPending(actorUserId, adaptationId, PENDING_STATUSES);
    event.status = 'dismissed';
    event.resolvedAt = new Date();
    await event.save();
    this.eventEmitter.emit(
      TRAINING_EVENTS.PLAN_ADAPTATION_DISMISSED,
      new PlanAdaptationDismissedEvent(event.athleteId, event.planId, event.id),
    );
    return toAdaptationEventView(event);
  }

  private async loadPending(
    actorUserId: string,
    adaptationId: string,
    allowed: string[],
  ): Promise<{ event: AdaptationEvent; athlete: Athlete; plan: TrainingPlan }> {
    const athleteView = await this.athletes.getOrCreateAthlete(actorUserId);
    const event = await this.adaptationEventModel.findOne({ where: { id: adaptationId, athleteId: athleteView.id } });
    if (!event) {
      throw new DomainNotFoundException('ADAPTATION_NOT_FOUND', 'Adaptation not found');
    }
    if (!allowed.includes(event.status)) {
      throw new DomainConflictException(
        'ADAPTATION_NOT_PROPOSED',
        'This adaptation is no longer waiting for a decision',
      );
    }
    const plan = event.planId ? await this.planModel.findByPk(event.planId) : null;
    if (!plan || plan.status !== 'active') {
      throw new DomainConflictException('ADAPTATION_NOT_PROPOSED', 'The plan of this adaptation is no longer active');
    }
    const athlete = await this.lookup.athlete(athleteView.id);
    return { event, athlete, plan };
  }

  private emitProposed(
    athlete: Athlete,
    planId: string | null,
    event: AdaptationEvent,
    action: string,
    changesCount: number,
    transaction?: Transaction,
  ): void {
    emitAfterCommit(
      this.eventEmitter,
      transaction,
      TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED,
      new PlanAdaptationProposedEvent(athlete.userId, athlete.id, planId, event.id, event.status, action, changesCount),
    );
  }

  private noopAdaptation(athleteId: string, workout: Workout): AdaptationEventView {
    return {
      id: `${workout.id}:noop`,
      athleteId,
      planId: workout.planId,
      workoutId: workout.id,
      type: KEEP_ACTION,
      input: {},
      decision: { action: KEEP_ACTION, changes: [] },
      reason: 'already_completed',
      confidence: 1,
      createdAt: new Date(),
    };
  }

  private workoutIdsOf(changes: Array<Record<string, unknown>>): string[] {
    return changes
      .map((change) => (typeof change.workoutId === 'string' ? change.workoutId : null))
      .filter((id): id is string => id !== null);
  }
}
