import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';

import type { AthleteProfileService } from '../../training/athletes/athlete-profile.service';
import type { Athlete } from '../../training/entities/athlete.entity';
import type { Workout } from '../../training/entities/workout.entity';
import type { TrainingService } from '../../training/training.service';
import type { UserConsentsService } from '../../users/consents/user-consents.service';
import type { DeviceSyncBatch } from '../entities/device-sync-batch.entity';
import type { Integration } from '../entities/integration.entity';
import type { IntegrationSyncState } from '../entities/integration-sync-state.entity';
import type { WorkoutSource } from '../entities/workout-source.entity';
import type { ActivityIngestionService } from '../ingestion/activity-ingestion.service';
import { DeviceIntegrationsService, emptyCounters } from './device-integrations.service';
import type { DeviceSyncBatchDto } from './dto/device-sync-batch.dto';

const SYNC_ID = '0192f3c4-6d1a-7b0e-9c3f-2a1b4c5d6e7f';

type Row = Record<string, unknown> & { save: jest.Mock; changed: jest.Mock; restore?: jest.Mock };

function integrationRow(overrides: Record<string, unknown> = {}): Row & Integration {
  return {
    id: 'int-1',
    athleteId: 'athlete-1',
    provider: 'apple_health',
    status: 'connected',
    scopes: ['workouts'],
    metadata: { profileSync: true },
    connectedAt: new Date('2026-10-01T00:00:00Z'),
    lastSyncAt: null,
    lastProfileSyncAt: null,
    externalUserId: null,
    deletedAt: null,
    save: jest.fn(),
    changed: jest.fn(),
    restore: jest.fn(),
    ...overrides,
  } as unknown as Row & Integration;
}

function batchRow(overrides: Record<string, unknown> = {}): Row & DeviceSyncBatch {
  return {
    id: 'batch-1',
    integrationId: 'int-1',
    syncId: SYNC_ID,
    batchIndex: 0,
    syncType: 'initial',
    isLast: true,
    status: 'pending',
    attempts: 0,
    payload: {
      activities: [
        {
          sourceActivityId: 'hk-1',
          type: 'run',
          startedAt: '2026-10-08T05:00:00.000Z',
          endedAt: '2026-10-08T05:50:00.000Z',
          utcOffsetMinutes: 180,
          durationSec: 3000,
          elapsedTimeSec: null,
          distanceMeters: 10000,
          elevationGainMeters: null,
          averageHeartRate: 148,
          maxHeartRate: null,
          cadence: null,
          calories: null,
          originAppId: 'com.apple.health',
          originDevice: null,
        },
      ],
      deletedSourceActivityIds: ['hk-old'],
      rejected: [{ sourceActivityId: 'hk-bad', code: 'ACTIVITY_TOO_SHORT' }],
    },
    save: jest.fn(),
    changed: jest.fn(),
    ...overrides,
  } as unknown as Row & DeviceSyncBatch;
}

const batchDto = (overrides: Partial<DeviceSyncBatchDto> = {}): DeviceSyncBatchDto => ({
  syncId: SYNC_ID,
  batchIndex: 0,
  syncType: 'initial',
  isLast: true,
  activities: [
    {
      sourceActivityId: 'hk-1',
      type: 'run',
      startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endedAt: new Date(Date.now() - 2 * 86_400_000 + 3_000_000).toISOString(),
      durationSec: 3000,
      distanceMeters: 10000,
    },
    {
      sourceActivityId: 'hk-short',
      type: 'run',
      startedAt: new Date(Date.now() - 86_400_000).toISOString(),
      endedAt: new Date(Date.now() - 86_400_000 + 600_000).toISOString(),
      durationSec: 600,
      distanceMeters: 300,
    },
  ],
  deletedSourceActivityIds: ['hk-old'],
  ...overrides,
});

describe('DeviceIntegrationsService', () => {
  let integrationModel: { findOne: jest.Mock; findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
  let batchModel: { findOne: jest.Mock; findByPk: jest.Mock; create: jest.Mock; count: jest.Mock; destroy: jest.Mock };
  let syncStateModel: { findOne: jest.Mock; create: jest.Mock };
  let sourceModel: { count: jest.Mock; findAll: jest.Mock };
  let workoutModel: { findOne: jest.Mock };
  let athleteModel: { findOne: jest.Mock; findByPk: jest.Mock };
  let queue: { add: jest.Mock };
  let trainingService: { getOrCreateAthlete: jest.Mock };
  let profileService: { applySourcedValues: jest.Mock };
  let consents: { assertCurrent: jest.Mock };
  let ingestion: { ingest: jest.Mock; removeSource: jest.Mock };
  let config: { get: jest.Mock };
  let events: { emit: jest.Mock };
  let service: DeviceIntegrationsService;

  beforeEach(() => {
    integrationModel = {
      findOne: jest.fn().mockResolvedValue(integrationRow()),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(integrationRow({ status: 'syncing' })),
      create: jest.fn().mockImplementation(async (values) => integrationRow(values)),
    };
    batchModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(batchRow()),
      create: jest.fn().mockImplementation(async (values) => batchRow({ ...values, id: 'batch-new' })),
      count: jest.fn().mockResolvedValue(0),
      destroy: jest.fn().mockResolvedValue(3),
    };
    syncStateModel = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() };
    sourceModel = { count: jest.fn().mockResolvedValue(0), findAll: jest.fn().mockResolvedValue([]) };
    workoutModel = { findOne: jest.fn() };
    athleteModel = {
      findOne: jest.fn().mockResolvedValue({ id: 'athlete-1' }),
      findByPk: jest.fn().mockResolvedValue({ id: 'athlete-1', userId: 'user-1', fieldSources: {} }),
    };
    queue = { add: jest.fn() };
    trainingService = { getOrCreateAthlete: jest.fn().mockResolvedValue({ id: 'athlete-1' }) };
    profileService = { applySourcedValues: jest.fn().mockResolvedValue(true) };
    consents = { assertCurrent: jest.fn() };
    ingestion = {
      ingest: jest.fn().mockResolvedValue({ outcome: 'created', workoutId: 'w-1' }),
      removeSource: jest.fn().mockResolvedValue('deleted'),
    };
    config = { get: jest.fn().mockReturnValue(true) };
    events = { emit: jest.fn() };

    service = new DeviceIntegrationsService(
      integrationModel as unknown as typeof Integration,
      batchModel as unknown as typeof DeviceSyncBatch,
      syncStateModel as unknown as typeof IntegrationSyncState,
      sourceModel as unknown as typeof WorkoutSource,
      workoutModel as unknown as typeof Workout,
      athleteModel as unknown as typeof Athlete,
      queue as unknown as Queue,
      trainingService as unknown as TrainingService,
      profileService as unknown as AthleteProfileService,
      consents as unknown as UserConsentsService,
      ingestion as unknown as ActivityIngestionService,
      config as unknown as ConfigService,
      events as unknown as EventEmitter2,
    );
  });

  describe('connect', () => {
    const body = { platform: 'ios' as const, deviceId: 'dev-1', grantedScopes: ['workouts' as const] };

    it('is not available while the feature flag is off', async () => {
      config.get.mockReturnValue(false);
      await expect(service.connect('user-1', 'apple_health', body)).rejects.toMatchObject({
        code: 'PROVIDER_NOT_SUPPORTED',
      });
    });

    it('does not serve OAuth providers', async () => {
      await expect(service.connect('user-1', 'strava', body)).rejects.toMatchObject({ code: 'PROVIDER_NOT_SUPPORTED' });
    });

    it('checks the platform', async () => {
      await expect(service.connect('user-1', 'health_connect', body)).rejects.toMatchObject({
        code: 'PROVIDER_PLATFORM_MISMATCH',
      });
    });

    it('requires the health data consent', async () => {
      consents.assertCurrent.mockRejectedValue(Object.assign(new Error('x'), { code: 'HEALTH_CONSENT_REQUIRED' }));
      await expect(service.connect('user-1', 'apple_health', body)).rejects.toMatchObject({
        code: 'HEALTH_CONSENT_REQUIRED',
      });
      expect(integrationModel.create).not.toHaveBeenCalled();
    });

    it('creates the integration and announces it', async () => {
      integrationModel.findOne.mockResolvedValue(null);
      const item = await service.connect('user-1', 'apple_health', { ...body, historyDepthDays: 90 });
      expect(integrationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'apple_health',
          status: 'connected',
          scopes: ['workouts'],
          metadata: expect.objectContaining({ platform: 'ios', historyDepthDays: 90, profileSync: true }),
        }),
      );
      expect(events.emit).toHaveBeenCalledWith('integrations.connected', expect.any(Object));
      expect(item).toMatchObject({ provider: 'apple_health', status: 'connected', available: true, profileSync: true });
    });

    it('is idempotent for a connected integration', async () => {
      const existing = integrationRow({ connectedAt: new Date('2026-09-01T00:00:00Z') });
      integrationModel.findOne.mockResolvedValue(existing);
      await service.connect('user-1', 'apple_health', body);
      expect(existing.connectedAt).toEqual(new Date('2026-09-01T00:00:00Z'));
      expect(events.emit).not.toHaveBeenCalledWith('integrations.connected', expect.anything());
    });
  });

  describe('acceptBatch', () => {
    it('stores valid items, returns rejected ones and enqueues processing', async () => {
      const integration = integrationRow();
      integrationModel.findOne.mockResolvedValue(integration);

      const result = await service.acceptBatch('user-1', 'apple_health', batchDto());

      expect(result).toEqual({
        syncId: SYNC_ID,
        batchId: 'batch-new',
        accepted: 2,
        rejected: [{ sourceActivityId: 'hk-short', code: 'ACTIVITY_TOO_SHORT' }],
      });
      expect(batchModel.create.mock.calls[0][0].payload.activities).toHaveLength(1);
      expect(syncStateModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: SYNC_ID, syncType: 'initial', status: 'in_progress' }),
      );
      expect(integration.status).toBe('syncing');
      expect(queue.add).toHaveBeenCalledWith(
        'device.process-batch',
        { batchId: 'batch-new' },
        expect.objectContaining({ jobId: 'device-batch:batch-new', attempts: 5 }),
      );
    });

    it('returns the stored batch on resend without enqueueing again', async () => {
      batchModel.findOne.mockResolvedValue(batchRow());
      const result = await service.acceptBatch('user-1', 'apple_health', batchDto());
      expect(result.batchId).toBe('batch-1');
      expect(batchModel.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects duplicates inside one batch', async () => {
      const dto = batchDto();
      dto.activities = [dto.activities[0], { ...dto.activities[0] }];
      const result = await service.acceptBatch('user-1', 'apple_health', dto);
      expect(result.rejected).toEqual([{ sourceActivityId: 'hk-1', code: 'DUPLICATE_IN_BATCH' }]);
    });

    it('refuses batches above the limit', async () => {
      const dto = batchDto({ deletedSourceActivityIds: Array.from({ length: 49 }, (_, i) => `d-${i}`) });
      await expect(service.acceptBatch('user-1', 'apple_health', dto)).rejects.toMatchObject({
        code: 'SYNC_BATCH_TOO_LARGE',
      });
    });

    it('refuses data for a disconnected integration', async () => {
      integrationModel.findOne.mockResolvedValue(integrationRow({ status: 'disconnected' }));
      await expect(service.acceptBatch('user-1', 'apple_health', batchDto())).rejects.toMatchObject({
        code: 'INTEGRATION_NOT_CONNECTED',
      });
    });
  });

  describe('processBatch', () => {
    it('ingests, deletes, counts outcomes and closes the session', async () => {
      const integration = integrationRow({ status: 'syncing' });
      const state = {
        status: 'in_progress',
        page: 0,
        processedCount: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        cursor: SYNC_ID,
        save: jest.fn(),
      };
      const batch = batchRow();
      integrationModel.findByPk.mockResolvedValue(integration);
      batchModel.findByPk.mockResolvedValue(batch);
      batchModel.findOne.mockResolvedValue({ id: 'batch-1' });
      syncStateModel.findOne.mockResolvedValue(state);

      await service.processBatch('batch-1');

      expect(ingestion.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'apple_health', sourceActivityId: 'hk-1', athleteId: 'athlete-1' }),
      );
      expect(ingestion.removeSource).toHaveBeenCalledWith('athlete-1', 'apple_health', 'hk-old');
      expect(batch.status).toBe('processed');
      expect(batch.result).toEqual({
        counters: { ...emptyCounters(), created: 1, deleted: 1, rejected: 1 },
        failedSourceActivityIds: [],
      });
      expect(state).toMatchObject({ status: 'completed', processedCount: 2, importedCount: 1, skippedCount: 1 });
      expect(integration.status).toBe('connected');
      expect(integration.lastSyncAt).toBeInstanceOf(Date);
      expect(events.emit).toHaveBeenCalledWith('integrations.sync_batch_processed', expect.any(Object));
      expect(events.emit).toHaveBeenCalledWith(
        'integrations.sync_completed',
        expect.objectContaining({ userId: 'user-1', syncId: SYNC_ID }),
      );
    });

    it('isolates a failing record and keeps processing the batch', async () => {
      const batch = batchRow();
      batch.payload.activities.push({ ...batch.payload.activities[0], sourceActivityId: 'hk-2' });
      batchModel.findByPk.mockResolvedValue(batch);
      ingestion.ingest.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ outcome: 'merged' });

      await service.processBatch('batch-1');

      expect(batch.status).toBe('processed');
      expect(batch.result).toMatchObject({
        counters: expect.objectContaining({ failed: 1, merged: 1 }),
        failedSourceActivityIds: ['hk-1'],
      });
    });

    it('keeps the session open while earlier batches are pending', async () => {
      const state = {
        status: 'in_progress',
        page: 0,
        processedCount: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        save: jest.fn(),
      };
      syncStateModel.findOne.mockResolvedValue(state);
      batchModel.findOne.mockResolvedValue({ id: 'batch-1' });
      batchModel.count.mockResolvedValue(1);

      await service.processBatch('batch-1');

      expect(state.status).toBe('in_progress');
      expect(events.emit).not.toHaveBeenCalledWith('integrations.sync_completed', expect.anything());
    });

    it('skips batches that were already processed', async () => {
      batchModel.findByPk.mockResolvedValue(batchRow({ status: 'processed' }));
      await service.processBatch('batch-1');
      expect(ingestion.ingest).not.toHaveBeenCalled();
    });
  });

  describe('applyProfileMetrics', () => {
    const recentDay = (daysAgo: number): string =>
      new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

    it('writes weight and the resting HR median with measurement times', async () => {
      const measuredAt = new Date(Date.now() - 3_600_000).toISOString();
      const result = await service.applyProfileMetrics('user-1', 'apple_health', {
        weight: { valueKg: 71.44, measuredAt },
        restingHeartRate: [
          { date: recentDay(1), bpm: 52 },
          { date: recentDay(2), bpm: 54 },
          { date: recentDay(3), bpm: 50 },
        ],
      });

      expect(result).toEqual({ applied: ['weightKg', 'restingHeartRate'], skipped: [] });
      expect(profileService.applySourcedValues).toHaveBeenCalledWith(
        'athlete-1',
        'apple_health',
        { weightKg: 71.4 },
        { weightKg: new Date(measuredAt) },
      );
      expect(profileService.applySourcedValues).toHaveBeenCalledWith(
        'athlete-1',
        'apple_health',
        { restingHeartRate: 52 },
        { restingHeartRate: new Date(`${recentDay(1)}T00:00:00Z`) },
      );
    });

    it('never overwrites manual values and skips older measurements', async () => {
      athleteModel.findByPk.mockResolvedValue({
        id: 'athlete-1',
        fieldSources: {
          weightKg: { source: 'manual', updatedAt: '2026-01-01T00:00:00Z' },
          restingHeartRate: { source: 'strava', updatedAt: new Date().toISOString() },
        },
      });
      const result = await service.applyProfileMetrics('user-1', 'apple_health', {
        weight: { valueKg: 70, measuredAt: new Date().toISOString() },
        restingHeartRate: [
          { date: recentDay(2), bpm: 52 },
          { date: recentDay(3), bpm: 54 },
          { date: recentDay(4), bpm: 50 },
        ],
      });
      expect(result.applied).toEqual([]);
      expect(result.skipped).toEqual([
        { field: 'weightKg', reason: 'manual_source' },
        { field: 'restingHeartRate', reason: 'stale' },
      ]);
      expect(profileService.applySourcedValues).not.toHaveBeenCalled();
    });

    it('reports insufficient data, out of range and old measurements', async () => {
      const result = await service.applyProfileMetrics('user-1', 'apple_health', {
        weight: { valueKg: 20, measuredAt: new Date().toISOString() },
        restingHeartRate: [{ date: recentDay(1), bpm: 52 }],
      });
      expect(result.skipped).toEqual([
        { field: 'weightKg', reason: 'out_of_range' },
        { field: 'restingHeartRate', reason: 'insufficient_data' },
      ]);
      const old = await service.applyProfileMetrics('user-1', 'apple_health', {
        weight: { valueKg: 70, measuredAt: '2025-01-01T00:00:00Z' },
      });
      expect(old.skipped).toEqual([{ field: 'weightKg', reason: 'stale' }]);
    });

    it('does nothing when profile sync is off', async () => {
      integrationModel.findOne.mockResolvedValue(integrationRow({ metadata: { profileSync: false } }));
      const result = await service.applyProfileMetrics('user-1', 'apple_health', {
        weight: { valueKg: 70, measuredAt: new Date().toISOString() },
      });
      expect(result).toEqual({ applied: [], skipped: [{ field: 'weightKg', reason: 'profile_sync_off' }] });
    });
  });

  it('disconnects every device integration when the consent is revoked', async () => {
    const hk = integrationRow();
    const hc = integrationRow({ id: 'int-2', provider: 'health_connect' });
    integrationModel.findAll.mockResolvedValue([hk, hc]);

    expect(await service.disconnectAllForUser('user-1')).toBe(2);
    expect(hk.status).toBe('disconnected');
    expect(hc.status).toBe('disconnected');
    expect(events.emit).toHaveBeenCalledTimes(2);
  });

  it('lists the sources of an own workout only', async () => {
    workoutModel.findOne.mockResolvedValue(null);
    await expect(service.listWorkoutSources('user-1', '0192f3c4-0000-7000-8000-000000000001')).rejects.toBeDefined();
  });
});
