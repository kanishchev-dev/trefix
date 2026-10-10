import type { EventEmitter2 } from '@nestjs/event-emitter';

import type { Athlete } from '../entities/athlete.entity';
import type { Workout } from '../entities/workout.entity';
import type { AthleteFieldSources } from '../training.constants';
import type { TrainingService } from '../training.service';
import { AthleteProfileService } from './athlete-profile.service';

describe('AthleteProfileService.applySourcedValues', () => {
  let athlete: Record<string, unknown> & { fieldSources: AthleteFieldSources; save: jest.Mock };
  let events: { emit: jest.Mock };
  let service: AthleteProfileService;

  beforeEach(() => {
    athlete = {
      id: 'athlete-1',
      userId: 'user-1',
      weightKg: 72,
      restingHeartRate: null,
      fieldSources: { weightKg: { source: 'strava', updatedAt: '2026-10-05T00:00:00.000Z' } },
      save: jest.fn(),
    };
    Object.assign(athlete, {
      get: (field: string) => athlete[field],
      set: (field: string, value: unknown) => {
        athlete[field] = value;
      },
      changed: jest.fn(),
    });
    events = { emit: jest.fn() };
    service = new AthleteProfileService(
      { findByPk: jest.fn().mockResolvedValue(athlete) } as unknown as typeof Athlete,
      {} as typeof Workout,
      {} as TrainingService,
      events as unknown as EventEmitter2,
    );
  });

  it('lets a fresher Health measurement replace a Strava value', async () => {
    const measuredAt = new Date('2026-10-08T06:00:00Z');
    const changed = await service.applySourcedValues(
      'athlete-1',
      'apple_health',
      { weightKg: 71.4 },
      { weightKg: measuredAt },
    );
    expect(changed).toBe(true);
    expect(athlete.weightKg).toBe(71.4);
    expect(athlete.fieldSources.weightKg).toEqual({ source: 'apple_health', updatedAt: measuredAt.toISOString() });
    expect(events.emit).toHaveBeenCalledWith('training.athlete.updated', expect.any(Object));
  });

  it('ignores a measurement older than the stored value', async () => {
    const changed = await service.applySourcedValues(
      'athlete-1',
      'health_connect',
      { weightKg: 70 },
      { weightKg: new Date('2026-10-01T00:00:00Z') },
    );
    expect(changed).toBe(false);
    expect(athlete.weightKg).toBe(72);
    expect(athlete.save).not.toHaveBeenCalled();
  });

  it('accepts resting HR from Health and keeps manual values untouched', async () => {
    athlete.fieldSources.weightKg = { source: 'manual', updatedAt: '2026-01-01T00:00:00.000Z' };
    await service.applySourcedValues(
      'athlete-1',
      'apple_health',
      { weightKg: 60, restingHeartRate: 52 },
      { weightKg: new Date(), restingHeartRate: new Date() },
    );
    expect(athlete.weightKg).toBe(72);
    expect(athlete.restingHeartRate).toBe(52);
    expect(athlete.fieldSources.restingHeartRate?.source).toBe('apple_health');
  });

  it('keeps the Strava behaviour without measurement times', async () => {
    await service.applySourcedValues('athlete-1', 'strava', { weightKg: 73 });
    expect(athlete.weightKg).toBe(73);
    expect(athlete.fieldSources.weightKg?.source).toBe('strava');
  });
});
