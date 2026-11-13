import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { CreateGoalDto } from '../dto/create-goal.dto';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { GoalCreatedEvent } from '../events/goal-created.event';
import { deriveLegacyRaceFields } from '../goal-taxonomy';
import { GoalView } from '../interfaces/training-views.interface';
import { ATHLETE_GOAL_STATUSES } from '../training.constants';
import { TRAINING_EVENTS } from '../training.events';
import { toGoalView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { assertGoalPayloadValid, DEFAULT_GOAL_PRIORITY } from './goal-payload';

/** Athlete goals in the universal (polymorphic) model. */
@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    private readonly lookup: TrainingLookupService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Creates a goal of the authenticated athlete; the payload is validated against its goal type. */
  async createGoal(actorUserId: string, dto: CreateGoalDto & { athleteId: string }): Promise<GoalView> {
    const athlete = await this.lookup.ownedAthlete(dto.athleteId, actorUserId);

    const payload = dto.goal;
    assertGoalPayloadValid({
      type: payload.type,
      current: payload.current,
      target: payload.target,
      description: payload.description,
    });
    // Older clients still read the flat race fields.
    const legacyFields = deriveLegacyRaceFields({
      type: payload.type,
      current: payload.current,
      target: payload.target,
    });

    const goal = await this.goalModel.create({
      athleteId: athlete.id,
      type: payload.type,
      payload: { current: payload.current, target: payload.target ?? {}, description: payload.description },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: payload.targetDate ?? null,
      priority: payload.priority ?? DEFAULT_GOAL_PRIORITY,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: dto.notes ?? null,
    });

    this.eventEmitter.emit(TRAINING_EVENTS.GOAL_CREATED, new GoalCreatedEvent(athlete.id, goal.id));
    return toGoalView(goal);
  }

  /** Returns a goal if it belongs to the authenticated user. */
  async getGoal(id: string, actorUserId: string): Promise<GoalView> {
    const goal = await this.lookup.goal(id);
    await this.lookup.ownedAthlete(goal.athleteId, actorUserId);
    return toGoalView(goal);
  }

  /** Latest goal of the authenticated athlete, if any. */
  async getLatestGoalForAthlete(athleteId: string, actorUserId: string): Promise<GoalView | null> {
    await this.lookup.ownedAthlete(athleteId, actorUserId);
    const goal = await this.lookup.latestGoal(athleteId);
    return goal ? toGoalView(goal) : null;
  }
}
