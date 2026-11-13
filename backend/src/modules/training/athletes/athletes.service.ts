import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';

import { CreateAthleteDto } from '../dto/create-athlete.dto';
import { Athlete } from '../entities/athlete.entity';
import { AthleteCreatedEvent } from '../events/athlete-created.event';
import { AthleteStateView, AthleteView } from '../interfaces/training-views.interface';
import { AthleteMetricsService, CurrentMetrics } from '../plans/athlete-metrics.service';
import {
  TRAINING_DEFAULT_DURATION_MINUTES,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
} from '../training.constants';
import { TRAINING_EVENTS } from '../training.events';
import { normalizeDays, toAthleteView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { AthleteStateService } from './athlete-state.service';

/** Experience level assumed for an athlete profile created implicitly. */
const IMPLICIT_ATHLETE_EXPERIENCE = 'intermediate';

/** Athlete profiles: one per user, created explicitly or on first use. */
@Injectable()
export class AthletesService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    private readonly lookup: TrainingLookupService,
    private readonly athleteState: AthleteStateService,
    private readonly athleteMetrics: AthleteMetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Owners of the given athlete profiles. */
  async userIdsOf(athleteIds: readonly string[]): Promise<Set<string>> {
    if (athleteIds.length === 0) {
      return new Set();
    }
    const athletes = await this.athleteModel.findAll({
      where: { id: { [Op.in]: [...new Set(athleteIds)] } },
      attributes: ['userId'],
    });
    return new Set(athletes.map((athlete) => athlete.userId));
  }

  /** Creates the athlete profile of the authenticated user and its first state snapshot. */
  async createAthlete(actorUserId: string, dto: CreateAthleteDto): Promise<AthleteView> {
    const existingAthlete = await this.athleteModel.findOne({ where: { userId: actorUserId } });
    if (existingAthlete) {
      throw new EntityAlreadyExistsException('Athlete', 'userId', actorUserId);
    }

    const athlete = await this.athleteModel.create({
      userId: actorUserId,
      age: dto.age ?? null,
      sex: dto.sex ?? null,
      heightCm: dto.heightCm ?? null,
      weightKg: dto.weightKg ?? null,
      experienceLevel: dto.experienceLevel,
      weeklyMileageKm: dto.weeklyMileageKm ?? TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
      sessionsPerWeek: dto.sessionsPerWeek ?? TRAINING_DEFAULT_FREQUENCY,
      recentRaceResults: dto.recentRaceResults ?? [],
      preferredTrainingDays: normalizeDays(dto.preferredTrainingDays),
      availableTrainingDays: normalizeDays(dto.availableTrainingDays),
      preferredWorkoutDurationMinutes: dto.preferredWorkoutDurationMinutes ?? TRAINING_DEFAULT_DURATION_MINUTES,
    });

    this.eventEmitter.emit(TRAINING_EVENTS.ATHLETE_CREATED, new AthleteCreatedEvent(athlete.id, actorUserId));
    await this.athleteState.recalculate(athlete.id);

    return toAthleteView(athlete);
  }

  /** Returns the athlete profile if it belongs to the authenticated user. */
  async getAthlete(id: string, actorUserId: string): Promise<AthleteView> {
    return toAthleteView(await this.lookup.ownedAthlete(id, actorUserId));
  }

  /** Returns the latest athlete state snapshot. */
  async getAthleteState(id: string, actorUserId: string): Promise<AthleteStateView> {
    const athlete = await this.lookup.ownedAthlete(id, actorUserId);
    return this.athleteState.latest(athlete.id);
  }

  /** The user's athlete profile; every training feature works without an explicit onboarding step. */
  async getOrCreateAthlete(userId: string): Promise<AthleteView> {
    const athlete = await this.lookup.athleteByUserId(userId);
    if (athlete) {
      return toAthleteView(athlete);
    }
    return this.createAthlete(userId, { experienceLevel: IMPLICIT_ATHLETE_EXPERIENCE });
  }

  async findById(id: string): Promise<AthleteView | null> {
    const athlete = await this.athleteModel.findByPk(id);
    return athlete ? toAthleteView(athlete) : null;
  }

  async findByUserId(userId: string): Promise<AthleteView | null> {
    const athlete = await this.lookup.athleteByUserId(userId);
    return athlete ? toAthleteView(athlete) : null;
  }

  /** Current metrics estimate for the plan creation prefill. */
  async getCurrentMetrics(actorUserId: string): Promise<CurrentMetrics> {
    const athlete = await this.getOrCreateAthlete(actorUserId);
    return this.athleteMetrics.currentMetrics(athlete.id);
  }
}
