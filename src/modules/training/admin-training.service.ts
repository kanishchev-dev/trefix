import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { UsersService } from '@/modules/users/users.service';

import {
  ADMIN_CALENDAR_DAY_MAX_WORKOUTS,
  ADMIN_CALENDAR_ERROR_CODES,
  ADMIN_CALENDAR_SUMMARY_MAX_DAYS,
  ADMIN_WORKOUT_ADHOC_PHASE,
  ADMIN_WORKOUT_DEFAULTS,
  ADMIN_WORKOUT_EVENT_NAMES,
  ADMIN_WORKOUT_SOURCE,
} from './admin-calendar.constants';
import { countDaysInclusive, resolveLocalRange, toLocalDateKey } from './admin-calendar-day.util';
import {
  AdminCalendarDayQueryDto,
  AdminCalendarSummaryQueryDto,
  AdminWorkoutCreateDto,
  AdminWorkoutUpdateDto,
} from './dto/admin-calendar.dto';
import { Athlete } from './entities/athlete.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutCreatedEvent } from './events/workout-created.event';
import { WorkoutUpdatedEvent, WorkoutUpdatedField } from './events/workout-updated.event';
import {
  AdminCalendarDayView,
  AdminCalendarSummaryDay,
  AdminCalendarSummaryView,
  AdminWorkoutMutationView,
  AdminWorkoutView,
} from './interfaces/admin-calendar-views.interface';
import { WORKOUT_STATUSES, WorkoutStatus, WorkoutType } from './training.constants';

const DEFAULT_TIMEZONE = 'UTC';

/**
 * Admin-panel workout calendar of a single user.
 *
 * Unlike the self-service flow, past dates are allowed (history correction)
 * and any non-completed workout may be edited, plan workouts included. A
 * completed workout is training history backed by load records, so it stays
 * read-only here. Everything is scoped through the athlete profile resolved
 * from the user id; a user without a profile gets an empty, read-only calendar.
 */
@Injectable()
export class AdminTrainingService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly eventEmitter: EventEmitter2,
    private readonly usersService: UsersService,
  ) {}

  /** Lists the workouts of one local calendar day of the user. */
  async listWorkoutsForDay(userId: string, query: AdminCalendarDayQueryDto): Promise<AdminCalendarDayView> {
    const timezone = query.timezone ?? DEFAULT_TIMEZONE;
    const athlete = await this.findAthlete(userId);
    if (!athlete) {
      return { date: query.date, timezone, workouts: [], total: 0, hasAthleteProfile: false };
    }

    const { start, endExclusive } = resolveLocalRange(query.date, query.date, timezone);
    const workouts = await this.workoutModel.findAll({
      where: { athleteId: athlete.id, scheduledAt: { [Op.gte]: start, [Op.lt]: endExclusive } },
      order: [
        ['scheduledAt', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      limit: ADMIN_CALENDAR_DAY_MAX_WORKOUTS,
    });

    return {
      date: query.date,
      timezone,
      workouts: workouts.map((workout) => this.toResponse(workout)),
      total: workouts.length,
      hasAthleteProfile: true,
    };
  }

  /** Per-day workout counts for a local date range, used to mark busy days in the month grid. */
  async summarizeRange(userId: string, query: AdminCalendarSummaryQueryDto): Promise<AdminCalendarSummaryView> {
    const timezone = query.timezone ?? DEFAULT_TIMEZONE;
    const span = countDaysInclusive(query.from, query.to);
    if (span < 1 || span > ADMIN_CALENDAR_SUMMARY_MAX_DAYS) {
      throw new DomainException(
        ADMIN_CALENDAR_ERROR_CODES.rangeInvalid,
        `The range must cover 1 to ${ADMIN_CALENDAR_SUMMARY_MAX_DAYS} days`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const base = { from: query.from, to: query.to, timezone };
    const athlete = await this.findAthlete(userId);
    if (!athlete) {
      return { ...base, days: [] };
    }

    const { start, endExclusive } = resolveLocalRange(query.from, query.to, timezone);
    const workouts = await this.workoutModel.findAll({
      attributes: ['scheduledAt', 'status'],
      where: { athleteId: athlete.id, scheduledAt: { [Op.gte]: start, [Op.lt]: endExclusive } },
      order: [['scheduledAt', 'ASC']],
    });

    const days = new Map<string, AdminCalendarSummaryDay>();
    for (const workout of workouts) {
      const date = toLocalDateKey(workout.scheduledAt, timezone);
      const day = days.get(date) ?? { date, total: 0, statuses: this.emptyStatusCounts() };
      day.total += 1;
      day.statuses[workout.status] += 1;
      days.set(date, day);
    }

    return { ...base, days: Array.from(days.values()) };
  }

  /** Adds a standalone workout to the user's calendar on behalf of the admin. */
  async createWorkout(
    actorUserId: string,
    userId: string,
    dto: AdminWorkoutCreateDto,
  ): Promise<AdminWorkoutMutationView> {
    const athlete = await this.loadAthleteOrThrow(userId);

    const workout = await this.workoutModel.create({
      athleteId: athlete.id,
      goalId: null,
      planId: null,
      weekNumber: 1,
      scheduledAt: new Date(dto.scheduledAt),
      type: dto.type,
      phase: ADMIN_WORKOUT_ADHOC_PHASE,
      status: dto.status ?? 'planned',
      orderInWeek: 1,
      durationMinutes: dto.durationMinutes ?? ADMIN_WORKOUT_DEFAULTS.durationMinutes,
      distanceKm: dto.distanceKm ?? ADMIN_WORKOUT_DEFAULTS.distanceKm,
      target: { title: dto.title ?? this.defaultTitle(dto.type), source: ADMIN_WORKOUT_SOURCE },
      steps: [],
      actual: null,
      analysis: null,
      completedAt: null,
      sourceProvider: ADMIN_WORKOUT_SOURCE,
    });

    this.eventEmitter.emit(
      ADMIN_WORKOUT_EVENT_NAMES.created,
      new WorkoutCreatedEvent(athlete.id, workout.id, workout.planId, actorUserId),
    );

    return { workout: this.toResponse(workout) };
  }

  /**
   * Patches the planned attributes of a workout. Only fields that actually
   * change are written, and the event carries their names so subscribers can
   * tell a reschedule from a cosmetic edit.
   */
  async updateWorkout(
    actorUserId: string,
    userId: string,
    workoutId: string,
    dto: AdminWorkoutUpdateDto,
  ): Promise<AdminWorkoutMutationView> {
    const athlete = await this.loadAthleteOrThrow(userId);
    const workout = await this.loadOwnedWorkout(workoutId, athlete.id);

    if (workout.status === 'completed' || workout.actual !== null) {
      throw new DomainException(
        ADMIN_CALENDAR_ERROR_CODES.workoutCompletedImmutable,
        'A completed workout is training history and cannot be edited',
        HttpStatus.CONFLICT,
      );
    }

    const changedFields: WorkoutUpdatedField[] = [];

    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt.getTime() !== workout.scheduledAt.getTime()) {
        workout.scheduledAt = scheduledAt;
        changedFields.push('scheduledAt');
      }
    }
    if (dto.type !== undefined && dto.type !== workout.type) {
      workout.type = dto.type;
      changedFields.push('type');
    }
    if (dto.durationMinutes !== undefined && dto.durationMinutes !== workout.durationMinutes) {
      workout.durationMinutes = dto.durationMinutes;
      changedFields.push('durationMinutes');
    }
    if (dto.distanceKm !== undefined && dto.distanceKm !== workout.distanceKm) {
      workout.distanceKm = dto.distanceKm;
      changedFields.push('distanceKm');
    }
    if (dto.status !== undefined && dto.status !== workout.status) {
      workout.status = dto.status;
      changedFields.push('status');
    }
    if (dto.title !== undefined && dto.title !== this.readTitle(workout)) {
      // JSONB columns are only persisted when reassigned, not when mutated in place.
      workout.target = { ...(workout.target ?? {}), title: dto.title };
      changedFields.push('title');
    }

    if (changedFields.length === 0) {
      return { workout: this.toResponse(workout) };
    }

    await workout.save();

    this.eventEmitter.emit(
      ADMIN_WORKOUT_EVENT_NAMES.updated,
      new WorkoutUpdatedEvent(athlete.id, workout.id, workout.planId, actorUserId, changedFields),
    );

    return { workout: this.toResponse(workout) };
  }

  // ------------------------------------------------------------------ internals

  /** Resolves the athlete profile of an existing user; throws when the user itself is missing. */
  private async findAthlete(userId: string): Promise<Athlete | null> {
    await this.usersService.findOne(userId);
    return this.athleteModel.findOne({ where: { userId } });
  }

  private async loadAthleteOrThrow(userId: string): Promise<Athlete> {
    const athlete = await this.findAthlete(userId);
    if (!athlete) {
      throw new DomainException(
        'ATHLETE_NOT_FOUND',
        `Athlete profile of user ${userId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return athlete;
  }

  private async loadOwnedWorkout(workoutId: string, athleteId: string): Promise<Workout> {
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId } });
    if (!workout) {
      throw new DomainException('WORKOUT_NOT_FOUND', `Workout ${workoutId} not found`, HttpStatus.NOT_FOUND);
    }
    return workout;
  }

  private emptyStatusCounts(): Record<WorkoutStatus, number> {
    return Object.fromEntries(WORKOUT_STATUSES.map((status) => [status, 0])) as Record<WorkoutStatus, number>;
  }

  /** Same default as the self-service flow, so admin-created workouts look native in the app. */
  private defaultTitle(type: WorkoutType): string {
    const words = type.split('_').join(' ');
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} Run`;
  }

  private readTitle(workout: Workout): string | null {
    const title = workout.target?.title;
    return typeof title === 'string' && title.length > 0 ? title : null;
  }

  private readSource(workout: Workout): string | null {
    const source = workout.target?.source;
    if (typeof source === 'string' && source.length > 0) {
      return source;
    }
    return workout.sourceProvider ?? (workout.planId ? 'plan' : null);
  }

  private toResponse(workout: Workout): AdminWorkoutView {
    return {
      id: workout.id,
      athleteId: workout.athleteId,
      planId: workout.planId,
      scheduledAt: workout.scheduledAt,
      type: workout.type,
      phase: workout.phase,
      status: workout.status,
      durationMinutes: workout.durationMinutes,
      distanceKm: workout.distanceKm,
      title: this.readTitle(workout),
      source: this.readSource(workout),
      hasActual: workout.actual !== null && workout.actual !== undefined,
      completedAt: workout.completedAt,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    };
  }
}
