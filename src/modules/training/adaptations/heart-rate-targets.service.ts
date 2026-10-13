import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { calculateHrZones, heartRateRangeForZone } from '../athletes/hr-zones';
import { AdaptationEvent } from '../entities/adaptation-event.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { PlanAdaptationProposedEvent, PlanAdaptedEvent } from '../events/plan-adapted.event';
import { AdaptationEventView } from '../interfaces/training-views.interface';
import { ADAPTATION_TYPE_HEART_RATE } from '../training.constants';
import { TRAINING_EVENTS } from '../training.events';
import { toAdaptationEventView, toRecord } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { PlanAdaptationApplier } from './plan-adaptation-applier';

type AdaptationStatus = 'applied' | 'proposed' | 'suggested';

// Reason code, translated by the clients like the engine reasons.
const HEART_RATE_ADAPTATION_REASON = 'heart_rate_zones_changed';

/** Keeps heart-rate targets of the active plan in line with the athlete's zones. */
@Injectable()
export class HeartRateTargetsService {
  constructor(
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly applier: PlanAdaptationApplier,
    private readonly coachPolicy: CoachPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Brings heart-rate targets of upcoming workouts of the active plan in line
   * with the athlete's current zones, following the coach adaptation mode.
   */
  async recalculateHeartRateTargets(athleteId: string): Promise<AdaptationEventView | null> {
    const athlete = await this.lookup.athlete(athleteId).catch(() => null);
    const plan = athlete ? await this.lookup.activePlan(athleteId) : null;
    if (!athlete || !plan) {
      return null;
    }
    const { zones } = calculateHrZones({
      method: athlete.hrZonesMethod,
      restingHeartRate: athlete.restingHeartRate,
      maxHeartRate: athlete.maxHeartRate,
      thresholdHeartRate: athlete.thresholdHeartRate,
      customUpperBounds: athlete.hrZonesCustom,
    });
    if (!zones) {
      return null;
    }

    const upcoming = await this.workoutModel.findAll({
      where: { planId: plan.id, status: 'planned', scheduledAt: { [Op.gte]: this.applier.startOfToday() } },
    });
    const changes = upcoming
      .map((workout) => {
        const target = toRecord(workout.target);
        const range = heartRateRangeForZone(zones, target.zone, athlete.restingHeartRate);
        if (!range || (target.heartRateMinBpm === range.min && target.heartRateMaxBpm === range.max)) {
          return null;
        }
        return { workoutId: workout.id, heartRateMinBpm: range.min, heartRateMaxBpm: range.max };
      })
      .filter((change): change is NonNullable<typeof change> => change !== null);
    if (changes.length === 0) {
      return null;
    }

    const policy = await this.coachPolicy.automaticAdaptationPolicy(athlete.userId);
    if (policy === 'skip') {
      return null;
    }
    const status: AdaptationStatus = policy === 'apply' ? 'applied' : policy === 'propose' ? 'proposed' : 'suggested';

    const event = await this.planModel.sequelize!.transaction(async (transaction) => {
      if (status === 'applied') {
        await this.applier.applyHeartRateChanges(plan, changes, transaction);
      }
      return this.adaptationEventModel.create(
        {
          athleteId,
          planId: plan.id,
          workoutId: null,
          type: ADAPTATION_TYPE_HEART_RATE,
          input: { zones },
          decision: { action: ADAPTATION_TYPE_HEART_RATE, changes },
          reason: HEART_RATE_ADAPTATION_REASON,
          confidence: 1,
          status,
          resolvedAt: status === 'applied' ? new Date() : null,
        },
        { transaction },
      );
    });

    if (status === 'applied') {
      this.eventEmitter.emit(TRAINING_EVENTS.PLAN_ADAPTED, new PlanAdaptedEvent(athleteId, plan.id, event.reason));
    } else {
      this.eventEmitter.emit(
        TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED,
        new PlanAdaptationProposedEvent(
          athlete.userId,
          athlete.id,
          plan.id,
          event.id,
          event.status,
          ADAPTATION_TYPE_HEART_RATE,
          changes.length,
        ),
      );
    }
    return toAdaptationEventView(event);
  }
}
