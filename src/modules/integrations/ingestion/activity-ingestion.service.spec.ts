import { EventEmitter2 } from '@nestjs/event-emitter';
import { Op } from 'sequelize';

import { GearAssignmentService } from '@/modules/training/gear/gear-assignment.service';

import type { AthletesService } from '../../training/athletes/athletes.service';
import type { Athlete } from '../../training/entities/athlete.entity';
import type { Workout } from '../../training/entities/workout.entity';
import { ImportedWorkoutLookupService } from '../../training/workouts/imported-workout-lookup.service';
import type { WorkoutImportService } from '../../training/workouts/workout-import.service';
import type { UserPreferencesService } from '../../users/preferences/user-preferences.service';
import type { Integration } from '../entities/integration.entity';
import type { WorkoutSource } from '../entities/workout-source.entity';
import type { RunningActivity } from '../interfaces/running-activity.interface';
import { ActivityDedupService } from './activity-dedup.service';
import { ActivityIngestionService } from './activity-ingestion.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function activity(overrides: Partial<RunningActivity> = {}): RunningActivity {
  return {
    id: 'apple_health:hk-1',
    athleteId: 'athlete-1',
    source: 'apple_health',
    sourceActivityId: 'hk-1',
    type: 'run',
    startedAt: new Date('2026-10-08T05:00:00Z'),
    endedAt: new Date('2026-10-08T05:50:00Z'),
    durationSec: 3000,
    movingTimeSec: 3000,
    distanceMeters: 10000,
    averageHeartRate: 148,
    utcOffsetMinutes: 180,
    originAppId: 'com.apple.health',
    importedAt: new Date(),
    updatedAt: new Date(),
    status: 'imported',
    ...overrides,
  };
}

type MockSource = WorkoutSource & { save: jest.Mock; destroy: jest.Mock; set: jest.Mock };

function sourceRow(overrides: Partial<WorkoutSource> = {}): MockSource {
  const row = {
    id: 'src-1',
    workoutId: 'w-1',
    athleteId: 'athlete-1',
    provider: 'strava',
    sourceActivityId: 's-1',
    isPrimary: true,
    startedAt: new Date('2026-10-08T05:00:05Z'),
    endedAt: new Date('2026-10-08T05:50:10Z'),
    durationSec: 3005,
    distanceMeters: 10030,
    utcOffsetMinutes: 180,
    facts: {
      type: 'run',
      movingTimeSec: 3005,
      elapsedTimeSec: 3100,
      elevationGainMeters: 40,
      averageHeartRate: null,
      maxHeartRate: null,
      cadence: 170,
      calories: null,
      gearExternalId: 'g1',
    },
    createdAt: new Date('2026-10-08T06:00:00Z'),
    deletedAt: null,
    set: jest.fn(),
    save: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  };
  return row as unknown as MockSource;
}

/** AthletesService over the athlete model mock: the spec asserts on model lookups. */
function athletesStub(model: { findByPk: jest.Mock }): AthletesService {
  return { findById: (id: string) => model.findByPk(id) } as unknown as AthletesService;
}

describe('ActivityIngestionService', () => {
  let sourceModel: Mocked<Pick<typeof WorkoutSource, 'findOne' | 'findAll' | 'create' | 'count' | 'destroy'>>;
  let workoutModel: Mocked<Pick<typeof Workout, 'findAll' | 'findByPk' | 'findOne' | 'count'>>;
  let integrationModel: Mocked<Pick<typeof Integration, 'count'>>;
  let athleteModel: Mocked<Pick<typeof Athlete, 'findByPk'>>;
  let trainingService: Mocked<
    Pick<
      WorkoutImportService,
      'completeWorkoutFromImport' | 'createImportedWorkout' | 'applyImportedFacts' | 'revertImportedWorkout'
    >
  >;
  let preferencesService: Mocked<Pick<UserPreferencesService, 'getEntity'>>;
  let eventEmitter: { emit: jest.Mock };
  let service: ActivityIngestionService;

  beforeEach(() => {
    sourceModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async (values) => sourceRow({ ...values, isPrimary: values.isPrimary })),
      count: jest.fn().mockResolvedValue(0),
      destroy: jest.fn(),
    };
    workoutModel = {
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue({ id: 'w-1', status: 'completed' }),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
    };
    integrationModel = { count: jest.fn().mockResolvedValue(0) };
    athleteModel = { findByPk: jest.fn().mockResolvedValue({ id: 'athlete-1', userId: 'user-1' }) };
    trainingService = {
      completeWorkoutFromImport: jest.fn(),
      createImportedWorkout: jest.fn().mockResolvedValue({ id: 'w-new' }),
      applyImportedFacts: jest.fn(),
      revertImportedWorkout: jest.fn().mockResolvedValue('deleted'),
    };
    preferencesService = { getEntity: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) };
    eventEmitter = { emit: jest.fn() };

    service = new ActivityIngestionService(
      sourceModel as unknown as typeof WorkoutSource,
      integrationModel as unknown as typeof Integration,
      trainingService as unknown as WorkoutImportService,
      new ImportedWorkoutLookupService(workoutModel as unknown as typeof Workout),
      athletesStub(athleteModel),
      { primaryDataSource: jest.fn().mockResolvedValue(null) } as unknown as GearAssignmentService,
      preferencesService as unknown as UserPreferencesService,
      new ActivityDedupService(),
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('origin filter', () => {
    it("skips Trefix's own records", async () => {
      const result = await service.ingest(activity({ originAppId: 'Kanishchev.Trefix' }));
      expect(result).toEqual({ outcome: 'skipped_own_record', workoutId: null });
      expect(trainingService.createImportedWorkout).not.toHaveBeenCalled();
    });

    it('skips Strava copies in Health while Strava is connected', async () => {
      integrationModel.count.mockResolvedValue(1);
      const result = await service.ingest(activity({ originAppId: 'com.strava.stravaride' }));
      expect(result.outcome).toBe('skipped_origin_connected');
      expect(integrationModel.count).toHaveBeenCalledWith({
        where: { athleteId: 'athlete-1', provider: 'strava', status: { [Op.ne]: 'disconnected' } },
      });
    });

    it('imports Strava copies in Health when Strava is not connected', async () => {
      const result = await service.ingest(activity({ originAppId: 'com.strava.stravaride' }));
      expect(result).toEqual({ outcome: 'created', workoutId: 'w-new' });
    });

    it('does not apply the filter to OAuth providers', async () => {
      await service.ingest(activity({ source: 'strava', originAppId: 'Kanishchev.Trefix' }));
      expect(trainingService.createImportedWorkout).toHaveBeenCalled();
    });
  });

  it('updates a known record and re-merges the workout', async () => {
    const known = sourceRow({ provider: 'apple_health', sourceActivityId: 'hk-1' });
    sourceModel.findOne.mockResolvedValue(known);
    sourceModel.findAll.mockResolvedValue([known]);

    const result = await service.ingest(activity({ distanceMeters: 10100 }));

    expect(result).toEqual({ outcome: 'updated', workoutId: 'w-1' });
    expect(known.set).toHaveBeenCalledWith(expect.objectContaining({ distanceMeters: 10100 }));
    expect(trainingService.applyImportedFacts).toHaveBeenCalledWith('w-1', expect.any(Object));
    expect(eventEmitter.emit).toHaveBeenCalledWith('integrations.activity_updated', expect.any(Object));
  });

  it('re-imports a record whose link was soft-deleted', async () => {
    const stale = sourceRow({ provider: 'apple_health', sourceActivityId: 'hk-1', deletedAt: new Date() });
    sourceModel.findOne.mockResolvedValue(stale);

    const result = await service.ingest(activity());

    expect(stale.destroy).toHaveBeenCalledWith({ force: true });
    expect(result.outcome).toBe('created');
  });

  it('merges a duplicate into the existing workout and keeps Strava as primary', async () => {
    const strava = sourceRow();
    const watch = sourceRow({ id: 'src-2', provider: 'apple_health', sourceActivityId: 'hk-1', isPrimary: false });
    sourceModel.findAll.mockResolvedValueOnce([strava]).mockResolvedValueOnce([watch, strava]);

    const result = await service.ingest(activity());

    expect(result).toEqual({ outcome: 'merged', workoutId: 'w-1' });
    expect(sourceModel.create).toHaveBeenCalledWith(expect.objectContaining({ workoutId: 'w-1', isPrimary: false }));
    expect(trainingService.applyImportedFacts).toHaveBeenCalledWith(
      'w-1',
      expect.objectContaining({ sourceProvider: 'strava', cadence: 170 }),
    );
    expect(strava.isPrimary).toBe(true);
    expect(watch.isPrimary).toBe(false);
  });

  it('fills merged facts from the secondary source', async () => {
    const strava = sourceRow();
    const watch = sourceRow({
      id: 'src-2',
      provider: 'apple_health',
      sourceActivityId: 'hk-1',
      isPrimary: false,
      facts: { ...sourceRow().facts, averageHeartRate: 148, gearExternalId: null },
    });
    sourceModel.findAll.mockResolvedValueOnce([strava]).mockResolvedValueOnce([strava, watch]);

    await service.ingest(activity());

    expect(trainingService.applyImportedFacts).toHaveBeenCalledWith(
      'w-1',
      expect.objectContaining({ sourceProvider: 'strava', averageHeartRate: 148 }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'integrations.activity_merged',
      expect.objectContaining({ workoutId: 'w-1', sourceProvider: 'strava', gearExternalId: 'g1' }),
    );
  });

  it('completes the planned workout of the local day', async () => {
    // 00:30 in UTC+3 on Oct 8 is 21:30 UTC on Oct 7.
    const nightRun = activity({
      startedAt: new Date('2026-10-07T21:30:00Z'),
      endedAt: new Date('2026-10-07T22:20:00Z'),
    });
    workoutModel.findAll.mockResolvedValueOnce([
      { id: 'plan-far', distanceKm: 20, durationMinutes: 120 },
      { id: 'plan-close', distanceKm: 10, durationMinutes: 55 },
    ]);

    const result = await service.ingest(nightRun);

    expect(result).toEqual({ outcome: 'matched_planned', workoutId: 'plan-close' });
    const where = workoutModel.findAll.mock.calls[0][0].where;
    expect(where.status).toBe('planned');
    expect(where.scheduledAt[Op.gte]).toEqual(new Date('2026-10-07T21:00:00Z'));
    expect(where.scheduledAt[Op.lt]).toEqual(new Date('2026-10-08T21:00:00Z'));
    expect(trainingService.completeWorkoutFromImport).toHaveBeenCalledWith(
      'plan-close',
      expect.objectContaining({ sourceProvider: 'apple_health', distanceKm: 10 }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('integrations.activity_imported', expect.any(Object));
  });

  it('does not close a planned run with a walk', async () => {
    workoutModel.findAll.mockResolvedValueOnce([{ id: 'plan-run', distanceKm: 5, durationMinutes: 50 }]);

    const result = await service.ingest(activity({ type: 'walk', distanceMeters: 5000 }));

    expect(result).toEqual({ outcome: 'created', workoutId: 'w-new' });
    expect(trainingService.completeWorkoutFromImport).not.toHaveBeenCalled();
    expect(trainingService.createImportedWorkout).toHaveBeenCalledWith(
      'athlete-1',
      expect.objectContaining({ sport: 'walk' }),
    );
  });

  it('closes the planned workout the run was started from', async () => {
    workoutModel.findOne.mockResolvedValue({ id: 'w-chosen', status: 'planned' });
    workoutModel.findAll.mockResolvedValue([{ id: 'w-closer', distanceKm: 10, durationMinutes: 50 }]);

    const result = await service.ingest(
      activity({ source: 'trefix', sourceActivityId: 'session-1', originAppId: undefined }),
      {
        plannedWorkoutId: 'w-chosen',
      },
    );

    expect(result).toEqual({ outcome: 'matched_planned', workoutId: 'w-chosen' });
    expect(trainingService.completeWorkoutFromImport).toHaveBeenCalledWith('w-chosen', expect.any(Object));
    const where = workoutModel.findOne.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'w-chosen', athleteId: 'athlete-1', status: 'planned' });
  });

  it('falls back to matching when the chosen workout is no longer open', async () => {
    workoutModel.findAll.mockResolvedValue([{ id: 'w-1', distanceKm: 10, durationMinutes: 50 }]);

    const result = await service.ingest(
      activity({ source: 'trefix', sourceActivityId: 'session-1', originAppId: undefined }),
      {
        plannedWorkoutId: 'w-done',
      },
    );

    expect(result).toEqual({ outcome: 'matched_planned', workoutId: 'w-1' });
  });

  it('keeps a free run separate when the athlete turned the link off', async () => {
    workoutModel.findAll.mockResolvedValue([]);

    const result = await service.ingest(
      activity({ source: 'trefix', sourceActivityId: 'session-1', originAppId: undefined }),
      { matchPlanned: false },
    );

    expect(result.outcome).not.toBe('matched_planned');
    expect(trainingService.completeWorkoutFromImport).not.toHaveBeenCalled();
  });

  it("falls back to the user's timezone when the offset is unknown", async () => {
    await service.ingest(activity({ utcOffsetMinutes: undefined, startedAt: new Date('2026-10-07T21:30:00Z') }));
    const where = workoutModel.findAll.mock.calls[0][0].where;
    expect(where.scheduledAt[Op.gte]).toEqual(new Date('2026-10-07T21:00:00Z'));
  });

  it('drops the link when completing the planned workout fails', async () => {
    workoutModel.findAll.mockResolvedValueOnce([{ id: 'plan-1', distanceKm: 10, durationMinutes: 50 }]);
    trainingService.completeWorkoutFromImport.mockRejectedValue(new Error('boom'));
    const created = sourceRow();
    sourceModel.create.mockResolvedValue(created);

    await expect(service.ingest(activity())).rejects.toThrow('boom');
    expect(created.destroy).toHaveBeenCalledWith({ force: true });
  });

  it('attaches the record to a manually closed workout with a similar distance', async () => {
    workoutModel.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'manual-far', distanceKm: 5, actual: { actualDistanceKm: 5 } },
      { id: 'manual-close', distanceKm: 10, actual: { actualDistanceKm: 9 } },
    ]);

    const result = await service.ingest(activity());

    expect(result).toEqual({ outcome: 'matched_manual', workoutId: 'manual-close' });
    expect(trainingService.applyImportedFacts).toHaveBeenCalledWith('manual-close', expect.any(Object));
  });

  it('does not attach to a manual workout with a distant distance', async () => {
    workoutModel.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'manual', distanceKm: 8, actual: { actualDistanceKm: 8 } }]);

    const result = await service.ingest(activity());

    expect(result.outcome).toBe('created');
  });

  it('creates a workout and its primary link otherwise', async () => {
    const result = await service.ingest(activity());

    expect(result).toEqual({ outcome: 'created', workoutId: 'w-new' });
    expect(trainingService.createImportedWorkout).toHaveBeenCalledWith(
      'athlete-1',
      expect.objectContaining({ sourceProvider: 'apple_health', sourceActivityId: 'hk-1', averageHeartRate: 148 }),
    );
    expect(sourceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ workoutId: 'w-new', isPrimary: true, utcOffsetMinutes: 180 }),
    );
  });

  describe('removeSource', () => {
    it('ignores unknown records', async () => {
      expect(await service.removeSource('athlete-1', 'strava', 'nope')).toBe('ignored');
    });

    it('keeps the workout while other sources remain', async () => {
      const strava = sourceRow();
      const watch = sourceRow({ id: 'src-2', provider: 'apple_health', sourceActivityId: 'hk-1', isPrimary: false });
      sourceModel.findOne.mockResolvedValue(strava);
      sourceModel.count.mockResolvedValue(1);
      sourceModel.findAll.mockResolvedValue([watch]);

      expect(await service.removeSource('athlete-1', 'strava', 's-1')).toBe('removed');
      expect(strava.destroy).toHaveBeenCalled();
      expect(watch.isPrimary).toBe(true);
      expect(watch.save).toHaveBeenCalled();
      expect(trainingService.applyImportedFacts).toHaveBeenCalledWith(
        'w-1',
        expect.objectContaining({ sourceProvider: 'apple_health' }),
      );
      expect(trainingService.revertImportedWorkout).not.toHaveBeenCalled();
    });

    it('reverts the workout when the last source is gone', async () => {
      sourceModel.findOne.mockResolvedValue(sourceRow());
      sourceModel.count.mockResolvedValue(0);
      trainingService.revertImportedWorkout.mockResolvedValue('replanned');

      expect(await service.removeSource('athlete-1', 'strava', 's-1')).toBe('replanned');
      expect(eventEmitter.emit).toHaveBeenCalledWith('integrations.activity_source_removed', expect.any(Object));
    });
  });
});
