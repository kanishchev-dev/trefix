import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';

/**
 * Loads training entities by id and checks who may see them.
 *
 * A resource of another user is reported as "not found", never "forbidden":
 * the API must not confirm that an id exists.
 */
@Injectable()
export class TrainingLookupService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
  ) {}

  async athlete(id: string, transaction?: Transaction): Promise<Athlete> {
    const athlete = await this.athleteModel.findByPk(id, { transaction });
    if (!athlete) {
      throw new EntityNotFoundException('Athlete', id);
    }
    return athlete;
  }

  async athleteByUserId(userId: string): Promise<Athlete | null> {
    return this.athleteModel.findOne({ where: { userId } });
  }

  /** The athlete, provided it belongs to the actor. */
  async ownedAthlete(id: string, actorUserId: string): Promise<Athlete> {
    const athlete = await this.athlete(id);
    this.ensureOwnership(athlete, actorUserId);
    return athlete;
  }

  async goal(id: string): Promise<AthleteGoal> {
    const goal = await this.goalModel.findByPk(id);
    if (!goal) {
      throw new EntityNotFoundException('Goal', id);
    }
    return goal;
  }

  async latestGoal(athleteId: string, transaction?: Transaction): Promise<AthleteGoal | null> {
    return this.goalModel.findOne({ where: { athleteId }, order: [['createdAt', 'DESC']], transaction });
  }

  async plan(id: string, transaction?: Transaction): Promise<TrainingPlan> {
    const plan = await this.planModel.findByPk(id, { transaction });
    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }
    return plan;
  }

  /** The single plan in work; the lifecycle guarantees at most one per athlete. */
  async activePlan(athleteId: string, transaction?: Transaction): Promise<TrainingPlan | null> {
    return this.planModel.findOne({
      where: { athleteId, status: 'active' },
      order: [['createdAt', 'DESC']],
      transaction,
    });
  }

  async workout(id: string, transaction?: Transaction): Promise<Workout> {
    const workout = await this.workoutModel.findByPk(id, { transaction });
    if (!workout) {
      throw new EntityNotFoundException('Workout', id);
    }
    return workout;
  }

  /** The workout row locked for the rest of the transaction; serializes concurrent completions. */
  async workoutForUpdate(id: string, transaction: Transaction): Promise<Workout> {
    const workout = await this.workoutModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!workout) {
      throw new EntityNotFoundException('Workout', id);
    }
    return workout;
  }

  /** Workouts of a plan in calendar order. */
  async planWorkouts(planId: string): Promise<Workout[]> {
    return this.workoutModel.findAll({
      where: { planId },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['scheduledAt', 'ASC'],
      ],
    });
  }

  ensureOwnership(athlete: Athlete, actorUserId: string): void {
    if (athlete.userId !== actorUserId) {
      throw new EntityNotFoundException('Athlete', athlete.id);
    }
  }
}
