import type { EventEmitter2 } from '@nestjs/event-emitter';

import type { TrainingLookupService } from '../training-lookup.service';
import { ManualWorkoutsService } from './manual-workouts.service';

describe('ManualWorkoutsService', () => {
  const tomorrow = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  type FakeWorkout = Record<string, unknown> & { save: jest.Mock; destroy: jest.Mock; distanceKm: number };

  const makeWorkout = (overrides: Record<string, unknown> = {}): FakeWorkout => ({
    id: 'workout-1',
    athleteId: 'athlete-1',
    goalId: null,
    planId: null,
    weekNumber: 1,
    scheduledAt: tomorrow(),
    type: 'easy',
    phase: 'adhoc',
    status: 'planned',
    orderInWeek: 1,
    durationMinutes: 40,
    distanceKm: 6,
    target: {},
    steps: [],
    actual: null,
    analysis: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  });

  type Setup = { service: ManualWorkoutsService; events: { emit: jest.Mock } };

  const setup = (workout: FakeWorkout): Setup => {
    const lookup = {
      workout: jest.fn().mockResolvedValue(workout),
      ownedAthlete: jest.fn().mockResolvedValue({ id: 'athlete-1' }),
    };
    const events = { emit: jest.fn() };
    const service = new ManualWorkoutsService(
      lookup as unknown as TrainingLookupService,
      events as unknown as EventEmitter2,
    );
    return { service, events };
  };

  it('changes only the fields that differ and reports them', async () => {
    const workout = makeWorkout();
    const { service, events } = setup(workout);
    await service.updateWorkout('user-1', 'workout-1', { distanceKm: 8, durationMinutes: 40 });
    expect(workout.distanceKm).toBe(8);
    expect(workout.save).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'training.workout.updated',
      expect.objectContaining({ changedFields: ['distanceKm'] }),
    );
  });

  it('does not save or emit when nothing changes', async () => {
    const workout = makeWorkout();
    const { service, events } = setup(workout);
    await service.updateWorkout('user-1', 'workout-1', { distanceKm: 6 });
    expect(workout.save).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses to move a workout to the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { service } = setup(makeWorkout());
    await expect(
      service.updateWorkout('user-1', 'workout-1', { scheduledAt: yesterday.toISOString() }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE' });
  });

  it('moves a missed workout to today', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const workout = makeWorkout({ scheduledAt: yesterday });
    const { service, events } = setup(workout);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    await service.updateWorkout('user-1', 'workout-1', { scheduledAt: today.toISOString() });
    expect(workout.scheduledAt).toEqual(today);
    expect(events.emit).toHaveBeenCalledWith(
      'training.workout.updated',
      expect.objectContaining({ changedFields: ['scheduledAt'] }),
    );
  });

  it('leaves plan workouts to the plan', async () => {
    const { service } = setup(makeWorkout({ planId: 'plan-1' }));
    await expect(service.deleteWorkout('user-1', 'workout-1')).rejects.toMatchObject({ code: 'WORKOUT_IN_PLAN' });
  });

  it('keeps completed workouts as history', async () => {
    const { service } = setup(makeWorkout({ status: 'completed' }));
    await expect(service.updateWorkout('user-1', 'workout-1', { distanceKm: 9 })).rejects.toMatchObject({
      code: 'WORKOUT_NOT_PLANNED',
    });
  });

  it('removes a planned manual workout and tells subscribers', async () => {
    const workout = makeWorkout();
    const { service, events } = setup(workout);
    await service.deleteWorkout('user-1', 'workout-1');
    expect(workout.destroy).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'training.workout.deleted',
      expect.objectContaining({ workoutId: 'workout-1' }),
    );
  });
});
