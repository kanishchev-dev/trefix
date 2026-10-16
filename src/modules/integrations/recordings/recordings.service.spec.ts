import type { StorageService } from '../../storage/storage.service';
import type { AthletesService } from '../../training/athletes/athletes.service';
import type { Workout } from '../../training/entities/workout.entity';
import type { GearService } from '../../training/gear/gear.service';
import type { GearAssignmentService } from '../../training/gear/gear-assignment.service';
import { WorkoutImportService } from '../../training/workouts/workout-import.service';
import type { WorkoutsService } from '../../training/workouts/workouts.service';
import type { ActivityIngestionService } from '../ingestion/activity-ingestion.service';
import type { RecordedActivityDto } from './dto/recorded-activity.dto';
import type { RecordedActivity } from './recorded-activity.entity';
import { RecordingsService } from './recordings.service';

function summary(overrides: Partial<RecordedActivityDto> = {}): RecordedActivityDto {
  return {
    clientSessionId: '0192f0c4-7b1a-7c3e-9a51-2f6d8e0b1a11',
    environment: 'outdoor',
    distanceSource: 'gps',
    startedAt: '2026-10-10T06:30:00Z',
    endedAt: '2026-10-10T07:22:10Z',
    utcOffsetMinutes: 180,
    elapsedSec: 3130,
    movingSec: 3012,
    distanceM: 10040,
    device: { platform: 'ios', model: 'iPhone16,2' },
    ...overrides,
  } as RecordedActivityDto;
}

const gzipTrack = {
  originalname: 'track.json.gz',
  mimetype: 'application/gzip',
  size: 4,
  buffer: Buffer.from([0x1f, 0x8b, 0, 0]),
};

/** WorkoutImportService whose tracker-details write goes to the workout model mock. */
function trackerDetailsWriter(model: { findByPk: jest.Mock }): WorkoutImportService {
  const service = new WorkoutImportService(
    model as unknown as typeof Workout,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return service;
}

describe('RecordingsService', () => {
  let recordingModel: { findOne: jest.Mock; create: jest.Mock };
  let workoutModel: { findByPk: jest.Mock };
  let trainingService: { getOrCreateAthlete: jest.Mock; getWorkout: jest.Mock };
  let gearService: { get: jest.Mock; assignToWorkout: jest.Mock };
  let ingestion: { ingest: jest.Mock };
  let storage: { uploadFile: jest.Mock; deleteFileQuietly: jest.Mock };
  let created: Record<string, unknown> & { save: jest.Mock; destroy: jest.Mock };
  let workout: Record<string, unknown> & { save: jest.Mock };
  let service: RecordingsService;

  beforeEach(() => {
    created = { id: 'rec-1', save: jest.fn(), destroy: jest.fn() };
    workout = { id: 'w-1', type: 'easy', excludeFromRecords: false, actual: { actualDistanceKm: 10 }, save: jest.fn() };
    recordingModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (values) => Object.assign(created, values)),
    };
    workoutModel = { findByPk: jest.fn().mockResolvedValue(workout) };
    trainingService = { getOrCreateAthlete: jest.fn().mockResolvedValue({ id: 'athlete-1' }), getWorkout: jest.fn() };
    gearService = { get: jest.fn(), assignToWorkout: jest.fn() };
    ingestion = { ingest: jest.fn().mockResolvedValue({ outcome: 'created', workoutId: 'w-1' }) };
    storage = { uploadFile: jest.fn().mockResolvedValue({ id: 'file-1' }), deleteFileQuietly: jest.fn() };
    service = new RecordingsService(
      recordingModel as unknown as typeof RecordedActivity,
      trainingService as unknown as AthletesService,
      trainingService as unknown as WorkoutsService,
      trackerDetailsWriter(workoutModel),
      gearService as unknown as GearService,
      gearService as unknown as GearAssignmentService,
      ingestion as unknown as ActivityIngestionService,
      storage as unknown as StorageService,
    );
  });

  it('stores the track, ingests a trefix activity and applies the tracker details', async () => {
    const result = await service.accept(
      'user-1',
      summary({ workoutType: 'long_run', rpe: 6, notes: 'Тяжело', gearId: 'gear-1', plannedWorkoutId: null }),
      gzipTrack,
    );

    expect(result).toEqual({
      created: true,
      response: { recordedActivityId: 'rec-1', workoutId: 'w-1', outcome: 'created' },
    });
    expect(storage.uploadFile).toHaveBeenCalledWith(
      gzipTrack,
      expect.objectContaining({ uploaderUserId: 'user-1', folder: 'tracks' }),
    );
    expect(recordingModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ trackFileId: 'file-1', distanceM: 10040 }),
    );
    const [activity, options] = ingestion.ingest.mock.calls[0];
    expect(activity).toMatchObject({
      source: 'trefix',
      sourceActivityId: summary().clientSessionId,
      type: 'run',
      durationSec: 3012,
    });
    expect(options).toEqual({ plannedWorkoutId: null, matchPlanned: true });
    expect(workout).toMatchObject({
      type: 'long_run',
      excludeFromRecords: false,
      actual: { actualDistanceKm: 10, rpe: 6, notes: 'Тяжело' },
    });
    expect(gearService.assignToWorkout).toHaveBeenCalledWith('user-1', 'w-1', 'gear-1');
    expect(created).toMatchObject({ workoutId: 'w-1', outcome: 'created' });
  });

  it('returns the stored result for a repeated session', async () => {
    recordingModel.findOne.mockResolvedValue({ id: 'rec-0', workoutId: 'w-0', outcome: 'completed_planned' });

    const result = await service.accept('user-1', summary());

    expect(result).toEqual({
      created: false,
      response: { recordedActivityId: 'rec-0', workoutId: 'w-0', outcome: 'completed_planned' },
    });
    expect(ingestion.ingest).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('keeps a planned workout type and leaves watch facts alone when merged', async () => {
    ingestion.ingest.mockResolvedValue({ outcome: 'merged', workoutId: 'w-watch' });

    const result = await service.accept('user-1', summary({ workoutType: 'tempo' }));

    expect(result.response.outcome).toBe('merged');
    expect(workoutModel.findByPk).not.toHaveBeenCalled();
  });

  it('keeps treadmill and pedometer runs out of distance records', async () => {
    await service.accept('user-1', summary({ environment: 'treadmill', distanceSource: 'manual' }));
    expect(ingestion.ingest.mock.calls[0][0].type).toBe('treadmill');
    expect(workout.excludeFromRecords).toBe(true);
  });

  it('closes the chosen planned workout', async () => {
    ingestion.ingest.mockResolvedValue({ outcome: 'matched_planned', workoutId: 'w-plan' });
    const result = await service.accept(
      'user-1',
      summary({ plannedWorkoutId: '0192f0c4-0000-7000-8000-000000000001', workoutType: 'easy' }),
    );
    expect(ingestion.ingest.mock.calls[0][1]).toEqual({
      plannedWorkoutId: '0192f0c4-0000-7000-8000-000000000001',
      matchPlanned: true,
    });
    expect(result.response.outcome).toBe('completed_planned');
    expect(workout.type).toBe('easy');
  });

  it('removes the record and the track when ingestion fails', async () => {
    ingestion.ingest.mockRejectedValue(new Error('boom'));

    await expect(service.accept('user-1', summary(), gzipTrack)).rejects.toThrow('boom');
    expect(storage.deleteFileQuietly).toHaveBeenCalledWith('file-1');
    expect(created.destroy).toHaveBeenCalled();
  });

  it.each([
    ['movingSec', summary({ movingSec: 4000 })],
    ['endedAt', summary({ endedAt: '2026-10-10T06:00:00Z' })],
    ['distanceM', summary({ distanceM: 50_000 })],
    ['distanceSource', summary({ environment: 'treadmill', distanceSource: 'gps' })],
  ])('rejects an implausible %s', async (field, dto) => {
    await expect(service.accept('user-1', dto)).rejects.toMatchObject({
      code: 'RECORDING_INVALID',
      details: { field },
    });
    expect(ingestion.ingest).not.toHaveBeenCalled();
  });

  it('rejects a track that is not gzip', async () => {
    await expect(
      service.accept('user-1', summary(), { ...gzipTrack, buffer: Buffer.from('{"a":1}') }),
    ).rejects.toMatchObject({ code: 'RECORDING_INVALID', details: { field: 'track' } });
  });

  it('answers 404 for a workout without a recording', async () => {
    await expect(service.getForWorkout('user-1', 'w-1')).rejects.toMatchObject({ code: 'RECORDING_NOT_FOUND' });
    expect(trainingService.getWorkout).toHaveBeenCalledWith('w-1', 'user-1');
  });
});
