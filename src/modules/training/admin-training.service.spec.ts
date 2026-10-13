import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { UsersService } from '@/modules/users/users.service';

import { AdminTrainingService } from './admin-training.service';
import { Athlete } from './entities/athlete.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutCreatedEvent } from './events/workout-created.event';
import { WorkoutUpdatedEvent } from './events/workout-updated.event';

const USER_ID = '0199b0c4-0000-7000-8000-000000000001';
const ACTOR_ID = '0199b0c4-0000-7000-8000-000000000002';
const ATHLETE = { id: 'athlete-1', userId: USER_ID } as Athlete;

const makeWorkout = (overrides: Partial<Record<string, unknown>> = {}): Workout =>
  ({
    id: 'workout-1',
    athleteId: ATHLETE.id,
    planId: null,
    scheduledAt: new Date('2026-10-06T06:00:00.000Z'),
    type: 'easy',
    phase: 'adhoc',
    status: 'planned',
    durationMinutes: 40,
    distanceKm: 6,
    target: { title: 'Easy Run', source: 'manual' },
    actual: null,
    completedAt: null,
    sourceProvider: 'manual',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Workout;

describe('AdminTrainingService', () => {
  let service: AdminTrainingService;
  const athleteModel = { findOne: jest.fn() };
  const workoutModel = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const usersService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    usersService.findOne.mockResolvedValue({ id: USER_ID });
    athleteModel.findOne.mockResolvedValue(ATHLETE);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminTrainingService,
        { provide: getModelToken(Athlete), useValue: athleteModel },
        { provide: getModelToken(Workout), useValue: workoutModel },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(AdminTrainingService);
  });

  describe('listWorkoutsForDay', () => {
    it('queries the local day boundaries of the requested timezone', async () => {
      workoutModel.findAll.mockResolvedValue([makeWorkout()]);

      const result = await service.listWorkoutsForDay(USER_ID, { date: '2026-10-06', timezone: 'Europe/Moscow' });

      const where = workoutModel.findAll.mock.calls[0][0].where;
      expect(where.athleteId).toBe(ATHLETE.id);
      expect(where.scheduledAt[Op.gte].toISOString()).toBe('2026-10-05T21:00:00.000Z');
      expect(where.scheduledAt[Op.lt].toISOString()).toBe('2026-10-06T21:00:00.000Z');
      expect(result).toMatchObject({
        date: '2026-10-06',
        timezone: 'Europe/Moscow',
        total: 1,
        hasAthleteProfile: true,
      });
      expect(result.workouts[0]).toMatchObject({
        id: 'workout-1',
        title: 'Easy Run',
        source: 'manual',
        hasActual: false,
      });
    });

    it('returns an empty read-only day when the user has no athlete profile', async () => {
      athleteModel.findOne.mockResolvedValue(null);

      const result = await service.listWorkoutsForDay(USER_ID, { date: '2026-10-06' });

      expect(result).toEqual({ date: '2026-10-06', timezone: 'UTC', workouts: [], total: 0, hasAthleteProfile: false });
      expect(workoutModel.findAll).not.toHaveBeenCalled();
    });

    it('propagates a missing user', async () => {
      usersService.findOne.mockRejectedValue(new EntityNotFoundException('User', USER_ID));

      await expect(service.listWorkoutsForDay(USER_ID, { date: '2026-10-06' })).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('summarizeRange', () => {
    it('groups workouts by local day and status', async () => {
      workoutModel.findAll.mockResolvedValue([
        makeWorkout({ scheduledAt: new Date('2026-10-05T22:00:00.000Z'), status: 'planned' }),
        makeWorkout({ scheduledAt: new Date('2026-10-06T10:00:00.000Z'), status: 'completed' }),
        makeWorkout({ scheduledAt: new Date('2026-10-07T10:00:00.000Z'), status: 'skipped' }),
      ]);

      const result = await service.summarizeRange(USER_ID, {
        from: '2026-10-01',
        to: '2026-10-31',
        timezone: 'Europe/Moscow',
      });

      expect(result.days).toEqual([
        { date: '2026-10-06', total: 2, statuses: { planned: 1, completed: 1, skipped: 0, cancelled: 0 } },
        { date: '2026-10-07', total: 1, statuses: { planned: 0, completed: 0, skipped: 1, cancelled: 0 } },
      ]);
    });

    it.each([
      ['reversed', '2026-10-31', '2026-10-01'],
      ['too long', '2026-01-01', '2026-12-31'],
    ])('rejects a %s range', async (_label, from, to) => {
      await expect(service.summarizeRange(USER_ID, { from, to })).rejects.toMatchObject({
        code: 'CALENDAR_RANGE_INVALID',
      });
      expect(workoutModel.findAll).not.toHaveBeenCalled();
    });
  });

  describe('createWorkout', () => {
    it('creates a standalone planned workout and emits training.workout.created', async () => {
      workoutModel.create.mockImplementation(async (values: Record<string, unknown>) =>
        makeWorkout({ ...values, id: 'workout-new' }),
      );

      const result = await service.createWorkout(ACTOR_ID, USER_ID, {
        scheduledAt: '2026-09-01T06:00:00.000Z',
        type: 'long_run',
      });

      expect(workoutModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          athleteId: ATHLETE.id,
          planId: null,
          status: 'planned',
          durationMinutes: 30,
          distanceKm: 5,
          target: { source: 'admin' },
          sourceProvider: 'admin',
          completedAt: null,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'training.workout.created',
        new WorkoutCreatedEvent(ATHLETE.id, 'workout-new', null, ACTOR_ID),
      );
      expect(result.workout).toMatchObject({ id: 'workout-new', source: 'admin' });
    });

    it('requires an athlete profile', async () => {
      athleteModel.findOne.mockResolvedValue(null);

      await expect(
        service.createWorkout(ACTOR_ID, USER_ID, { scheduledAt: '2026-10-06T06:00:00.000Z', type: 'easy' }),
      ).rejects.toMatchObject({ code: 'ATHLETE_NOT_FOUND', status: HttpStatus.NOT_FOUND });
      expect(workoutModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateWorkout', () => {
    it('writes only changed fields and reports them in the event', async () => {
      const workout = makeWorkout({ planId: 'plan-1' });
      workoutModel.findOne.mockResolvedValue(workout);

      const result = await service.updateWorkout(ACTOR_ID, USER_ID, workout.id, {
        scheduledAt: '2026-10-07T06:00:00.000Z',
        type: 'easy',
        distanceKm: 8,
        title: 'Recovery jog',
      });

      expect(workoutModel.findOne).toHaveBeenCalledWith({ where: { id: workout.id, athleteId: ATHLETE.id } });
      expect(workout.save).toHaveBeenCalledTimes(1);
      expect(workout.target).toEqual({ title: 'Recovery jog', source: 'manual' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'training.workout.updated',
        new WorkoutUpdatedEvent(ATHLETE.id, workout.id, 'plan-1', ACTOR_ID, ['scheduledAt', 'distanceKm', 'title']),
      );
      expect(result.workout).toMatchObject({ distanceKm: 8, title: 'Recovery jog', planId: 'plan-1' });
    });

    it('skips the write and the event when nothing changed', async () => {
      const workout = makeWorkout();
      workoutModel.findOne.mockResolvedValue(workout);

      await service.updateWorkout(ACTOR_ID, USER_ID, workout.id, { type: 'easy', durationMinutes: 40 });

      expect(workout.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it.each([
      ['completed status', { status: 'completed' }],
      ['an actual result', { status: 'skipped', actual: { actualDistanceKm: 5 } }],
    ])('rejects edits of a workout with %s', async (_label, overrides) => {
      const workout = makeWorkout(overrides);
      workoutModel.findOne.mockResolvedValue(workout);

      const error = await service.updateWorkout(ACTOR_ID, USER_ID, workout.id, { distanceKm: 10 }).catch((e) => e);

      expect(error).toBeInstanceOf(DomainException);
      expect(error).toMatchObject({ code: 'WORKOUT_COMPLETED_IMMUTABLE', status: HttpStatus.CONFLICT });
      expect(workout.save).not.toHaveBeenCalled();
    });

    it('does not reach workouts of another athlete', async () => {
      workoutModel.findOne.mockResolvedValue(null);

      await expect(
        service.updateWorkout(ACTOR_ID, USER_ID, 'foreign-workout', { distanceKm: 10 }),
      ).rejects.toMatchObject({ code: 'WORKOUT_NOT_FOUND' });
    });
  });
});
