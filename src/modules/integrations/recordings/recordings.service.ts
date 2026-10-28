import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';

import {
  DomainBadRequestException,
  DomainConflictException,
  DomainNotFoundException,
  DomainPayloadTooLargeException,
} from '@/common/exceptions/domain-exceptions';
import { InvariantViolationException } from '@/common/exceptions/invariant-violation.exception';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { WorkoutImportService } from '@/modules/training/workouts/workout-import.service';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';

import { StorageUploadedFile } from '../../storage/interfaces/storage-uploaded-file.interface';
import { StorageService } from '../../storage/storage.service';
import { GearService } from '../../training/gear/gear.service';
import { GearAssignmentService } from '../../training/gear/gear-assignment.service';
import { type WorkoutSport } from '../../training/training.constants';
import {
  GPS_DISTANCE_SOURCES,
  RECORDING_LIMITS,
  type RecordingEnvironment,
  SPORT_PACE_LIMITS,
  TRACKER_PROVIDER,
} from '../constants/integrations.constants';
import { ActivityIngestionService, IngestOutcome } from '../ingestion/activity-ingestion.service';
import { RunningActivity, RunningActivityType } from '../interfaces/running-activity.interface';
import {
  RecordedActivityAcceptedDto,
  RecordedActivityDto,
  RecordingOutcome,
  WorkoutRecordingResponseDto,
} from './dto/recorded-activity.dto';
import { RecordedActivity } from './recorded-activity.entity';

const RUN_TYPE_BY_ENVIRONMENT: Record<Exclude<RecordingEnvironment, 'indoor'>, RunningActivityType> = {
  outdoor: 'run',
  trail: 'trail_run',
  treadmill: 'treadmill',
};

function sportOf(dto: RecordedActivityDto): WorkoutSport {
  return dto.sport ?? 'run';
}

/** Source record kind: a run keeps its surface; other sports are one kind each. */
function activityTypeOf(dto: RecordedActivityDto): RunningActivityType {
  const sport = sportOf(dto);
  if (sport !== 'run') {
    return sport;
  }
  return dto.environment === 'indoor' ? 'treadmill' : RUN_TYPE_BY_ENVIRONMENT[dto.environment];
}

const OUTCOME_BY_INGEST: Partial<Record<IngestOutcome, RecordingOutcome>> = {
  created: 'created',
  updated: 'created',
  matched_planned: 'completed_planned',
  merged: 'merged',
  matched_manual: 'matched_manual',
};

/** Wall-clock slack between `elapsedSec` and `endedAt - startedAt`, seconds. */
const ELAPSED_TOLERANCE_SEC = 120;
/** Below this distance the average pace says nothing and is not checked. */
const PACE_CHECK_MIN_DISTANCE_M = 200;
const GZIP_MAGIC = [0x1f, 0x8b];

export interface AcceptResult {
  response: RecordedActivityAcceptedDto;
  /** False when the same session was already stored and this is a repeat. */
  created: boolean;
}

/**
 * Takes runs recorded by the in-app tracker. A record becomes a `trefix`
 * activity in the common ingestion pipeline, so it is deduplicated against
 * watch records and matched to the plan like any import; a run started from a
 * planned workout closes exactly that workout.
 */
@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    @InjectModel(RecordedActivity)
    private readonly recordingModel: typeof RecordedActivity,
    private readonly athletesService: AthletesService,
    private readonly workoutsService: WorkoutsService,
    private readonly workoutImportService: WorkoutImportService,
    private readonly gearService: GearService,
    private readonly gearAssignmentService: GearAssignmentService,
    private readonly ingestion: ActivityIngestionService,
    private readonly storageService: StorageService,
  ) {}

  async accept(userId: string, dto: RecordedActivityDto, track?: StorageUploadedFile): Promise<AcceptResult> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);

    const existing = await this.recordingModel.findOne({
      where: { athleteId: athlete.id, clientSessionId: dto.clientSessionId },
    });
    if (existing?.workoutId) {
      return { response: this.toAccepted(existing), created: false };
    }
    if (existing) {
      // A previous attempt stopped half-way: start over.
      await this.discard(existing);
    }

    this.validate(dto, track);
    if (dto.gearId) {
      await this.gearService.get(userId, dto.gearId);
    }

    const trackFile = track
      ? await this.storageService.uploadFile(track, {
          uploaderUserId: userId,
          scopeType: 'recorded_activity',
          scopeId: dto.clientSessionId,
          folder: 'tracks',
        })
      : null;

    let recording: RecordedActivity;
    try {
      recording = await this.recordingModel.create(this.toAttributes(athlete.id, dto, trackFile?.id ?? null));
    } catch (error) {
      if (trackFile) await this.storageService.deleteFileQuietly(trackFile.id);
      if (error instanceof UniqueConstraintError) {
        // A parallel request with the same session won the race.
        throw new DomainConflictException('RECORDING_IN_PROGRESS', 'The recording is being saved, retry later');
      }
      throw error;
    }

    try {
      const result = await this.ingestion.ingest(this.toRunningActivity(athlete.id, dto), {
        plannedWorkoutId: dto.plannedWorkoutId ?? null,
        matchPlanned: dto.linkPlanned !== false,
      });
      const outcome = OUTCOME_BY_INGEST[result.outcome];
      if (!result.workoutId || !outcome) {
        throw new InvariantViolationException(`Unexpected ingestion outcome ${result.outcome} for a tracker record`);
      }
      await this.applyRecordingDetails(userId, result.workoutId, outcome, dto);
      recording.workoutId = result.workoutId;
      recording.outcome = outcome;
      await recording.save();
      return { response: this.toAccepted(recording), created: true };
    } catch (error) {
      this.logger.error(
        `Recording ${dto.clientSessionId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.discard(recording);
      throw error;
    }
  }

  async getForWorkout(userId: string, workoutId: string): Promise<WorkoutRecordingResponseDto> {
    await this.workoutsService.getWorkout(workoutId, userId);
    const recording = await this.recordingModel.findOne({
      where: { workoutId },
      order: [['createdAt', 'DESC']],
    });
    if (!recording) {
      throw new DomainNotFoundException('RECORDING_NOT_FOUND', 'The workout has no tracker recording');
    }
    return this.toRecordingResponse(recording);
  }

  private validate(dto: RecordedActivityDto, track?: StorageUploadedFile): void {
    const startedAt = Date.parse(dto.startedAt);
    const endedAt = Date.parse(dto.endedAt);
    const wallSec = (endedAt - startedAt) / 1000;
    if (!(wallSec > 0)) {
      this.invalid('endedAt', 'The run must end after it starts');
    }
    if (dto.elapsedSec > wallSec + ELAPSED_TOLERANCE_SEC) {
      this.invalid('elapsedSec', 'Elapsed time is longer than the run');
    }
    if (dto.movingSec > dto.elapsedSec) {
      this.invalid('movingSec', 'Moving time is longer than elapsed time');
    }
    const sport = sportOf(dto);
    if (sport === 'strength') {
      if (dto.environment !== 'indoor') {
        this.invalid('environment', 'A strength session is recorded indoors');
      }
      if (dto.distanceM > 0) {
        this.invalid('distanceM', 'A strength session has no distance');
      }
    } else if (dto.environment === 'indoor') {
      this.invalid('environment', 'Only a strength session is recorded as indoor');
    }
    if (sport !== 'strength' && dto.distanceM >= PACE_CHECK_MIN_DISTANCE_M) {
      const limits = SPORT_PACE_LIMITS[sport];
      const pace = (dto.movingSec / dto.distanceM) * 1000;
      if (pace < limits.min || pace > limits.max) {
        this.invalid('distanceM', 'Average pace is out of the plausible range');
      }
    }
    if (dto.environment === 'treadmill' && GPS_DISTANCE_SOURCES.includes(dto.distanceSource)) {
      this.invalid('distanceSource', 'A treadmill run is not measured by GPS');
    }
    if (track) {
      if (track.size > RECORDING_LIMITS.maxTrackFileBytes) {
        throw new DomainPayloadTooLargeException('RECORDING_TRACK_TOO_LARGE', 'The track file is too large');
      }
      const head = track.buffer?.subarray(0, 2);
      if (!head || head[0] !== GZIP_MAGIC[0] || head[1] !== GZIP_MAGIC[1]) {
        this.invalid('track', 'The track must be a gzip file');
      }
    }
  }

  private invalid(field: string, message: string): never {
    throw new DomainBadRequestException('RECORDING_INVALID', message, { field });
  }

  /**
   * Fields only the tracker knows. They are written only when the recording is
   * the workout's main record: a run merged into a watch record keeps the watch facts.
   */
  private async applyRecordingDetails(
    userId: string,
    workoutId: string,
    outcome: RecordingOutcome,
    dto: RecordedActivityDto,
  ): Promise<void> {
    if (outcome === 'merged') {
      return;
    }
    await this.workoutImportService.applyTrackerDetails(workoutId, {
      type: outcome === 'created' ? (dto.workoutType ?? undefined) : undefined,
      // Distance records count only runs measured outdoors by satellites.
      excludeFromRecords:
        sportOf(dto) !== 'run' || dto.environment !== 'outdoor' || !GPS_DISTANCE_SOURCES.includes(dto.distanceSource),
      rpe: dto.rpe,
      notes: dto.notes,
    });
    if (dto.gearId) {
      await this.gearAssignmentService.assignToWorkout(userId, workoutId, dto.gearId);
    }
  }

  private async discard(recording: RecordedActivity): Promise<void> {
    if (recording.trackFileId) {
      await this.storageService.deleteFileQuietly(recording.trackFileId);
    }
    await recording.destroy();
  }

  private toRunningActivity(athleteId: string, dto: RecordedActivityDto): RunningActivity {
    const now = new Date();
    return {
      id: `${TRACKER_PROVIDER}:${dto.clientSessionId}`,
      athleteId,
      source: TRACKER_PROVIDER,
      sourceActivityId: dto.clientSessionId,
      type: activityTypeOf(dto),
      startedAt: new Date(dto.startedAt),
      endedAt: new Date(dto.endedAt),
      durationSec: dto.movingSec,
      movingTimeSec: dto.movingSec,
      elapsedTimeSec: dto.elapsedSec,
      distanceMeters: dto.distanceM,
      elevationGainMeters: dto.elevationGainM ?? undefined,
      averagePaceSecPerKm: dto.distanceM > 0 ? Math.round((dto.movingSec / dto.distanceM) * 1000) : undefined,
      averageSpeedMps: dto.movingSec > 0 ? dto.distanceM / dto.movingSec : undefined,
      averageHeartRate: dto.avgHeartRate ?? undefined,
      maxHeartRate: dto.maxHeartRate ?? undefined,
      cadence: dto.avgCadence ?? undefined,
      utcOffsetMinutes: dto.utcOffsetMinutes,
      originDevice: dto.device.model ?? undefined,
      importedAt: now,
      updatedAt: now,
      status: 'imported',
    };
  }

  private toAttributes(
    athleteId: string,
    dto: RecordedActivityDto,
    trackFileId: string | null,
  ): Partial<RecordedActivity> {
    return {
      athleteId,
      clientSessionId: dto.clientSessionId,
      environment: dto.environment,
      sport: sportOf(dto),
      distanceSource: dto.distanceSource,
      plannedWorkoutId: dto.plannedWorkoutId ?? null,
      startedAt: new Date(dto.startedAt),
      endedAt: new Date(dto.endedAt),
      utcOffsetMinutes: dto.utcOffsetMinutes ?? null,
      elapsedSec: dto.elapsedSec,
      movingSec: dto.movingSec,
      distanceM: dto.distanceM,
      measuredDistanceM: dto.measuredDistanceM ?? null,
      elevationGainM: dto.elevationGainM ?? null,
      elevationLossM: dto.elevationLossM ?? null,
      avgPaceSecPerKm: dto.avgPaceSecPerKm ?? null,
      bestPaceSecPerKm: dto.bestPaceSecPerKm ?? null,
      avgHeartRate: dto.avgHeartRate ?? null,
      maxHeartRate: dto.maxHeartRate ?? null,
      avgCadence: dto.avgCadence ?? null,
      splits: (dto.splits ?? []).map((split) => ({
        km: split.km,
        durationSec: split.durationSec,
        paceSecPerKm: split.paceSecPerKm,
        elevationGainM: split.elevationGainM ?? null,
        avgHeartRate: split.avgHeartRate ?? null,
        partial: split.partial ?? false,
      })),
      laps: (dto.laps ?? []).map((lap) => ({
        index: lap.index,
        kind: lap.kind,
        plannedSec: lap.plannedSec ?? null,
        plannedM: lap.plannedM ?? null,
        actualSec: lap.actualSec,
        actualM: lap.actualM,
        avgPaceSecPerKm: lap.avgPaceSecPerKm ?? null,
        inTarget: lap.inTarget ?? null,
      })),
      pauses: (dto.pauses ?? []).map((pause) => ({
        startedAt: pause.startedAt,
        endedAt: pause.endedAt,
        auto: pause.auto,
      })),
      routeLine: dto.routeLine ?? null,
      routeBounds: dto.routeBounds ? { ...dto.routeBounds } : null,
      // Rounded to ~100 m: the exact start is often the athlete's home.
      startPoint: dto.startPoint
        ? { lat: Math.round(dto.startPoint.lat * 1000) / 1000, lng: Math.round(dto.startPoint.lng * 1000) / 1000 }
        : null,
      trackFileId,
      device: {
        platform: dto.device.platform,
        osVersion: dto.device.osVersion ?? null,
        appVersion: dto.device.appVersion ?? null,
        model: dto.device.model ?? null,
      },
      feeling: dto.feeling ?? null,
      rpe: dto.rpe ?? null,
      notes: dto.notes ?? null,
    };
  }

  private toAccepted(recording: RecordedActivity): RecordedActivityAcceptedDto {
    return {
      recordedActivityId: recording.id,
      workoutId: recording.workoutId!,
      outcome: recording.outcome ?? 'created',
    };
  }

  private toRecordingResponse(recording: RecordedActivity): WorkoutRecordingResponseDto {
    return {
      id: recording.id,
      environment: recording.environment,
      sport: recording.sport ?? 'run',
      distanceSource: recording.distanceSource,
      startedAt: recording.startedAt.toISOString(),
      endedAt: recording.endedAt.toISOString(),
      elapsedSec: recording.elapsedSec,
      movingSec: recording.movingSec,
      distanceM: recording.distanceM,
      measuredDistanceM: recording.measuredDistanceM,
      elevationGainM: recording.elevationGainM,
      elevationLossM: recording.elevationLossM,
      avgPaceSecPerKm: recording.avgPaceSecPerKm,
      bestPaceSecPerKm: recording.bestPaceSecPerKm,
      avgHeartRate: recording.avgHeartRate,
      maxHeartRate: recording.maxHeartRate,
      avgCadence: recording.avgCadence,
      splits: recording.splits,
      laps: recording.laps,
      pauses: recording.pauses,
      routeLine: recording.routeLine,
      routeBounds: recording.routeBounds,
      trackFileId: recording.trackFileId,
      feeling: recording.feeling,
      rpe: recording.rpe,
      notes: recording.notes,
    };
  }
}
