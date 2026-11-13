import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';

import { UsersService } from '@/modules/users/users.service';

import { AdaptationsService } from './adaptations/adaptations.service';
import { AdminWorkoutsService } from './admin-workouts.service';
import { AthleteStateService } from './athletes/athlete-state.service';
import { Workout } from './entities/workout.entity';
import { GearAssignmentService } from './gear/gear-assignment.service';
import { ProgressService } from './progress/progress.service';
import { TrainingEngine } from './training.engine';
import { TRAINING_EVENTS } from './training.events';
import { TrainingLookupService } from './training-lookup.service';
import { WorkoutsService } from './workouts/workouts.service';

const USER_ID = 'user-1';
const ATHLETE = { id: 'athlete-1', userId: USER_ID };

type FakeWorkout = Record<string, unknown> & { save: jest.Mock; destroy: jest.Mock };

const makeWorkout = (overrides: Record<string, unknown> = {}): FakeWorkout => ({
  id: 'w-1',
  athleteId: ATHLETE.id,
  planId: null,
  status: 'completed',
  sourceProvider: 'manual',
  scheduledAt: new Date('2026-10-14T07:00:00.000Z'),
  type: 'easy',
  durationMinutes: 45,
  distanceKm: 8,
  target: {},
  actual: { actualDistanceKm: 8.4, actualDurationMinutes: 44 },
  analysis: { trainingLoad: 50 },
  completedAt: new Date('2026-10-14T08:00:00.000Z'),
  save: jest.fn(),
  destroy: jest.fn(),
  ...overrides,
});

describe('AdminWorkoutsService', () => {
  let service: AdminWorkoutsService;
  let workout: FakeWorkout;
  const transaction = { afterCommit: jest.fn((callback: () => void) => callback()) };
  const workoutModel = {
    findOne: jest.fn(),
    sequelize: { transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(transaction)) },
  };
  const lookup = { athleteByUserId: jest.fn(), workoutForUpdate: jest.fn() };
  const workoutsService = { completeWorkout: jest.fn() };
  const athleteState = { removeWorkoutLoad: jest.fn(), recalculate: jest.fn(), recordWorkoutLoad: jest.fn() };
  const engine = { analyzeWorkout: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    workout = makeWorkout();
    lookup.athleteByUserId.mockResolvedValue(ATHLETE);
    lookup.workoutForUpdate.mockImplementation(async () => workout);
    workoutModel.findOne.mockImplementation(async () => workout);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminWorkoutsService,
        { provide: getModelToken(Workout), useValue: workoutModel },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
        { provide: TrainingLookupService, useValue: lookup },
        { provide: WorkoutsService, useValue: workoutsService },
        { provide: AthleteStateService, useValue: athleteState },
        { provide: TrainingEngine, useValue: engine },
        { provide: GearAssignmentService, useValue: {} },
        { provide: ProgressService, useValue: {} },
        { provide: AdaptationsService, useValue: {} },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = moduleRef.get(AdminWorkoutsService);
  });

  it('refuses to work without an athlete profile instead of creating one', async () => {
    lookup.athleteByUserId.mockResolvedValue(null);

    await expect(service.getWorkout(USER_ID, 'w-1')).rejects.toMatchObject({ code: 'ATHLETE_NOT_FOUND' });
  });

  it('completes a skipped workout by reopening it first', async () => {
    workout = makeWorkout({ status: 'skipped', actual: null });

    await service.complete(USER_ID, 'w-1', { actualDurationMinutes: 40, actualDistanceKm: 7 });

    expect(workout.status).toBe('planned');
    expect(workout.save).toHaveBeenCalled();
    expect(workoutsService.completeWorkout).toHaveBeenCalledWith(USER_ID, 'w-1', {
      actualDurationMinutes: 40,
      actualDistanceKm: 7,
    });
  });

  it('reopens a hand-entered result and recalculates the load', async () => {
    await service.reopen(USER_ID, 'w-1');

    expect(workout).toMatchObject({ status: 'planned', actual: null, analysis: null, completedAt: null });
    expect(athleteState.removeWorkoutLoad).toHaveBeenCalledWith('w-1', transaction);
    expect(athleteState.recalculate).toHaveBeenCalledWith(ATHLETE.id, transaction);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      TRAINING_EVENTS.WORKOUT_UPDATED,
      expect.objectContaining({ changedFields: ['status', 'actual'] }),
    );
  });

  it('keeps results that came from an integration', async () => {
    workout = makeWorkout({ sourceProvider: 'strava' });

    await expect(service.reopen(USER_ID, 'w-1')).rejects.toMatchObject({ code: 'WORKOUT_HAS_SOURCES' });
    expect(workout.save).not.toHaveBeenCalled();
  });

  it('changes plan workouts only through the plan', async () => {
    workout = makeWorkout({ planId: 'plan-1' });

    await expect(service.delete(USER_ID, 'w-1')).rejects.toMatchObject({ code: 'WORKOUT_BELONGS_TO_PLAN' });
    expect(workout.destroy).not.toHaveBeenCalled();
  });

  it('deletes a completed ad-hoc workout with its load', async () => {
    await service.delete(USER_ID, 'w-1');

    expect(workout.destroy).toHaveBeenCalledWith({ transaction });
    expect(athleteState.removeWorkoutLoad).toHaveBeenCalledWith('w-1', transaction);
    expect(eventEmitter.emit).toHaveBeenCalledWith(TRAINING_EVENTS.WORKOUT_DELETED, expect.anything());
  });

  it('corrects the result of a completed workout only', async () => {
    workout = makeWorkout({ status: 'planned' });

    await expect(
      service.updateResult(USER_ID, 'w-1', { actualDurationMinutes: 40, actualDistanceKm: 7 }),
    ).rejects.toMatchObject({ code: 'WORKOUT_NOT_COMPLETED' });
  });

  it('records the before and after of a corrected result', async () => {
    engine.analyzeWorkout.mockReturnValue({ analysis: { trainingLoad: 60 } });

    await service.updateResult(USER_ID, 'w-1', { actualDurationMinutes: 46, actualDistanceKm: 9 });

    expect(athleteState.recordWorkoutLoad).toHaveBeenCalled();
    const [, event] = eventEmitter.emit.mock.calls[0];
    expect(event.changes.actual.from).toMatchObject({ actualDistanceKm: 8.4 });
    expect(event.changes.actual.to).toMatchObject({ actualDistanceKm: 9 });
  });
});
