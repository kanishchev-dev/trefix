import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserPreferences } from './user-preferences.entity';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  const stored = (): Record<string, unknown> => ({
    userId: 'user-1',
    distanceUnit: 'km',
    coachProactive: { preWorkout: true, workoutReview: true },
    notifications: { workoutReminder: true, workoutReminderTime: 'morning' },
    set(key: string, value: unknown): void {
      this[key] = value;
    },
    save: jest.fn(),
  });

  it('merges partial coach and notification settings over stored values and defaults', async () => {
    const preferences = stored();
    const emit = jest.fn();
    const service = new UserPreferencesService(
      { findOrCreate: jest.fn().mockResolvedValue([preferences]) } as unknown as typeof UserPreferences,
      { emit } as unknown as EventEmitter2,
    );

    const result = await service.update('user-1', {
      distanceUnit: 'mi',
      coachProactive: { workoutReview: false },
      notifications: { workoutReminderTime: '1h' },
    });

    expect(result.distanceUnit).toBe('mi');
    expect(result.coachProactive).toEqual({
      preWorkout: true,
      workoutReview: false,
      wellbeingCheck: true,
      weeklySummary: true,
      missedSupport: true,
    });
    expect(result.notifications).toMatchObject({
      workoutReminder: true,
      workoutReminderTime: '1h',
      workoutSynced: false,
    });
    expect(emit).toHaveBeenCalledWith(
      'preferences.updated',
      expect.objectContaining({ changedFields: ['distanceUnit', 'coachProactive', 'notifications'] }),
    );
  });
});
