import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError } from 'sequelize';

import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { WorkoutView } from '@/modules/training/interfaces/training-views.interface';
import { ImportedWorkoutLookupService } from '@/modules/training/workouts/imported-workout-lookup.service';
import { WorkoutImportService } from '@/modules/training/workouts/workout-import.service';

import { resolveLocalRange, toLocalDateKey } from '../../training/admin-calendar-day.util';
import { UserPreferencesService } from '../../users/preferences/user-preferences.service';
import {
  ACTIVITY_DEDUP,
  DEVICE_PROVIDERS,
  HEALTH_ORIGIN_PROVIDER_MAP,
  IMPORTED_ACTIVITY_SOURCES,
  INTEGRATION_STATUSES,
  MANUAL_MATCH_MAX_DISTANCE_DIFF_RATIO,
  RECORDING_LIMITS,
  TREFIX_APP_IDS,
} from '../constants/integrations.constants';
import { Integration } from '../entities/integration.entity';
import { WorkoutSource, WorkoutSourceFacts } from '../entities/workout-source.entity';
import { ActivityImportedEvent } from '../events/activity-imported.event';
import { ActivitySourceChangedEvent } from '../events/activity-source-changed.event';
import { RunningActivity } from '../interfaces/running-activity.interface';
import { ActivityDedupService, MergedSourceFacts, SourceRecord } from './activity-dedup.service';

export type IngestOutcome =
  | 'created'
  | 'updated'
  | 'merged'
  | 'matched_planned'
  | 'matched_manual'
  | 'skipped_own_record'
  | 'skipped_origin_connected';

export interface IngestOptions {
  /** The run was started from this planned workout: close it instead of guessing a match. */
  plannedWorkoutId?: string | null;
}

export interface IngestResult {
  outcome: IngestOutcome;
  workoutId: string | null;
}

export type RemoveSourceOutcome = 'removed' | 'replanned' | 'deleted' | 'ignored';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Columns of `workout_sources` taken from the activity itself. */
interface SourceAttributes {
  originAppId: string | null;
  originDevice: string | null;
  startedAt: Date;
  endedAt: Date;
  utcOffsetMinutes: number | null;
  durationSec: number;
  distanceMeters: number;
  facts: WorkoutSourceFacts;
}

/**
 * The only writer of imported facts into workouts. Every provider hands its
 * normalized `RunningActivity` here; the service decides whether the record
 * updates a known source, joins an existing workout as a duplicate, closes a
 * planned or manually closed workout, or becomes a new workout.
 *
 * Callers must serialize ingestion per athlete: two parallel calls for the
 * same run are resolved by the unique key of `workout_sources`, not by locks.
 */
@Injectable()
export class ActivityIngestionService {
  private readonly logger = new Logger(ActivityIngestionService.name);

  constructor(
    @InjectModel(WorkoutSource)
    private readonly sourceModel: typeof WorkoutSource,
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    private readonly workoutImportService: WorkoutImportService,
    private readonly workoutLookup: ImportedWorkoutLookupService,
    private readonly athletesService: AthletesService,
    private readonly preferencesService: UserPreferencesService,
    private readonly dedup: ActivityDedupService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingest(activity: RunningActivity, options: IngestOptions = {}): Promise<IngestResult> {
    const originSkip = await this.checkOrigin(activity);
    if (originSkip) {
      return { outcome: originSkip, workoutId: null };
    }

    const known = await this.findKnownSource(activity);
    if (known) {
      known.set(this.toSourceAttributes(activity));
      await known.save();
      const merged = await this.syncWorkoutWithSources(known.workoutId);
      this.emitChanged(INTEGRATIONS_EVENTS.ACTIVITY_UPDATED, activity.athleteId, known.workoutId, merged);
      return { outcome: 'updated', workoutId: known.workoutId };
    }

    const record = this.toRecord(activity);

    const duplicate = await this.findDuplicate(activity.athleteId, record);
    if (duplicate) {
      await this.createSource(activity, duplicate.workoutId, false);
      const merged = await this.syncWorkoutWithSources(duplicate.workoutId);
      this.emitChanged(INTEGRATIONS_EVENTS.ACTIVITY_MERGED, activity.athleteId, duplicate.workoutId, merged);
      return { outcome: 'merged', workoutId: duplicate.workoutId };
    }

    const facts = this.dedup.merge([record]);
    const dayRange = await this.resolveLocalDay(activity);

    const planned =
      (await this.findChosenPlanned(activity.athleteId, options.plannedWorkoutId, dayRange)) ??
      (await this.findPlannedMatch(activity.athleteId, dayRange, record));
    if (planned) {
      const source = await this.createSource(activity, planned.id, true);
      try {
        await this.workoutImportService.completeWorkoutFromImport(planned.id, facts.facts);
      } catch (error) {
        await source.destroy({ force: true });
        throw error;
      }
      this.emitImported(activity.athleteId, planned.id, facts);
      return { outcome: 'matched_planned', workoutId: planned.id };
    }

    const manual = await this.findManualMatch(activity.athleteId, dayRange, record);
    if (manual) {
      const source = await this.createSource(activity, manual.id, true);
      try {
        await this.workoutImportService.applyImportedFacts(manual.id, facts.facts);
      } catch (error) {
        await source.destroy({ force: true });
        throw error;
      }
      this.emitImported(activity.athleteId, manual.id, facts);
      return { outcome: 'matched_manual', workoutId: manual.id };
    }

    const created = await this.workoutImportService.createImportedWorkout(activity.athleteId, facts.facts);
    try {
      await this.createSource(activity, created.id, true);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        // A parallel ingestion stored the same record first; drop our copy and let the retry update it.
        await this.workoutImportService.revertImportedWorkout(created.id);
      }
      throw error;
    }
    this.emitImported(activity.athleteId, created.id, facts);
    return { outcome: 'created', workoutId: created.id };
  }

  /**
   * A provider deleted its record. The workout keeps living while other
   * sources remain; otherwise a plan workout returns to `planned` and an
   * ad-hoc one is deleted.
   */
  async removeSource(athleteId: string, provider: string, sourceActivityId: string): Promise<RemoveSourceOutcome> {
    const source = await this.sourceModel.findOne({ where: { athleteId, provider, sourceActivityId } });
    if (!source) {
      return 'ignored';
    }
    const workoutId = source.workoutId;
    await source.destroy();

    if (!(await this.workoutLookup.workoutExists(workoutId))) {
      return 'removed';
    }

    const remaining = await this.sourceModel.count({ where: { workoutId } });
    let outcome: RemoveSourceOutcome;
    if (remaining > 0) {
      await this.syncWorkoutWithSources(workoutId);
      outcome = 'removed';
    } else {
      outcome = await this.workoutImportService.revertImportedWorkout(workoutId);
    }

    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.ACTIVITY_SOURCE_REMOVED,
      new ActivitySourceChangedEvent(athleteId, workoutId, provider, sourceActivityId),
    );
    return outcome;
  }

  /**
   * Re-elects the primary source and writes merged facts into the workout.
   * Returns null when the workout has no sources left.
   */
  async syncWorkoutWithSources(workoutId: string): Promise<MergedSourceFacts | null> {
    const sources = await this.sourceModel.findAll({ where: { workoutId } });
    if (sources.length === 0) {
      return null;
    }
    const merged = this.dedup.merge(sources.map((source) => this.sourceToRecord(source)));

    for (const source of sources) {
      const isPrimary =
        source.provider === merged.primary.provider && source.sourceActivityId === merged.primary.sourceActivityId;
      if (source.isPrimary !== isPrimary) {
        source.isPrimary = isPrimary;
        await source.save();
      }
    }

    const workout = await this.workoutLookup.findWorkout(workoutId);
    if (workout?.status === 'completed') {
      await this.workoutImportService.applyImportedFacts(workoutId, merged.facts);
    }
    return merged;
  }

  private async checkOrigin(activity: RunningActivity): Promise<IngestOutcome | null> {
    if (!(DEVICE_PROVIDERS as readonly string[]).includes(activity.source) || !activity.originAppId) {
      return null;
    }
    if (TREFIX_APP_IDS.includes(activity.originAppId)) {
      return 'skipped_own_record';
    }
    const viaProvider = HEALTH_ORIGIN_PROVIDER_MAP[activity.originAppId];
    if (!viaProvider) {
      return null;
    }
    const connected = await this.integrationModel.count({
      where: {
        athleteId: activity.athleteId,
        provider: viaProvider,
        status: { [Op.ne]: INTEGRATION_STATUSES.DISCONNECTED },
      },
    });
    return connected > 0 ? 'skipped_origin_connected' : null;
  }

  /** Active link of this record; a soft-deleted one is purged so the record can be imported anew. */
  private async findKnownSource(activity: RunningActivity): Promise<WorkoutSource | null> {
    const source = await this.sourceModel.findOne({
      where: {
        athleteId: activity.athleteId,
        provider: activity.source,
        sourceActivityId: activity.sourceActivityId,
      },
      paranoid: false,
    });
    if (!source) {
      return null;
    }
    if (source.deletedAt) {
      await source.destroy({ force: true });
      return null;
    }
    if (!(await this.workoutLookup.workoutExists(source.workoutId))) {
      // The user deleted the workout: forget the stale link and import as new.
      await this.sourceModel.destroy({ where: { workoutId: source.workoutId }, force: true });
      return null;
    }
    return source;
  }

  private async findDuplicate(athleteId: string, record: SourceRecord): Promise<WorkoutSource | null> {
    const windowMs = ACTIVITY_DEDUP.candidateWindowSec * 1000;
    const candidates = await this.sourceModel.findAll({
      where: {
        athleteId,
        provider: { [Op.ne]: record.provider },
        startedAt: {
          [Op.gte]: new Date(record.startedAt.getTime() - windowMs),
          [Op.lte]: new Date(record.startedAt.getTime() + windowMs),
        },
      },
    });
    const byRecord = new Map(candidates.map((candidate) => [this.sourceToRecord(candidate), candidate]));
    const duplicateRecord = this.dedup.findDuplicate(record, [...byRecord.keys()]);
    const duplicate = duplicateRecord ? (byRecord.get(duplicateRecord) ?? null) : null;
    if (!duplicate) {
      return null;
    }
    if (!(await this.workoutLookup.workoutExists(duplicate.workoutId))) {
      await this.sourceModel.destroy({ where: { workoutId: duplicate.workoutId }, force: true });
      return null;
    }
    return duplicate;
  }

  /** The planned workout the athlete started the run from, if it is still open and dated around the run. */
  private async findChosenPlanned(
    athleteId: string,
    workoutId: string | null | undefined,
    dayRange: { start: Date; endExclusive: Date },
  ): Promise<WorkoutView | null> {
    if (!workoutId) {
      return null;
    }
    const tolerance = RECORDING_LIMITS.plannedWorkoutDayTolerance * DAY_MS;
    return this.workoutLookup.findOpenPlanned(athleteId, workoutId, {
      from: new Date(dayRange.start.getTime() - tolerance),
      toExclusive: new Date(dayRange.endExclusive.getTime() + tolerance),
    });
  }

  private async findPlannedMatch(
    athleteId: string,
    dayRange: { start: Date; endExclusive: Date },
    record: SourceRecord,
  ): Promise<WorkoutView | null> {
    const planned = await this.workoutLookup.listPlanned(athleteId, {
      from: dayRange.start,
      toExclusive: dayRange.endExclusive,
    });
    if (planned.length === 0) {
      return null;
    }
    const distanceKm = record.distanceMeters / 1000;
    const durationMinutes = record.durationSec / 60;
    return [...planned].sort((a, b) => {
      const byDistance = Math.abs(a.distanceKm - distanceKm) - Math.abs(b.distanceKm - distanceKm);
      if (byDistance !== 0) {
        return byDistance;
      }
      return Math.abs(a.durationMinutes - durationMinutes) - Math.abs(b.durationMinutes - durationMinutes);
    })[0];
  }

  /** A workout the user closed by hand on the same day with a similar distance. */
  private async findManualMatch(
    athleteId: string,
    dayRange: { start: Date; endExclusive: Date },
    record: SourceRecord,
  ): Promise<WorkoutView | null> {
    const completed = await this.workoutLookup.listManuallyCompleted(
      athleteId,
      { from: dayRange.start, toExclusive: dayRange.endExclusive },
      IMPORTED_ACTIVITY_SOURCES,
    );
    const distanceKm = record.distanceMeters / 1000;
    const scored = completed
      .map((workout) => {
        const manualKm = Number(workout.actual?.actualDistanceKm ?? workout.distanceKm);
        return { workout, diff: Math.abs(manualKm - distanceKm), manualKm };
      })
      .filter(({ diff, manualKm }) => manualKm > 0 && diff / manualKm <= MANUAL_MATCH_MAX_DISTANCE_DIFF_RATIO)
      .sort((a, b) => a.diff - b.diff);
    return scored[0]?.workout ?? null;
  }

  /**
   * UTC bounds of the athlete's local calendar day of the run. The offset
   * reported with the activity wins; otherwise the user's timezone, then UTC.
   */
  private async resolveLocalDay(activity: RunningActivity): Promise<{ start: Date; endExclusive: Date }> {
    if (typeof activity.utcOffsetMinutes === 'number') {
      const offsetMs = activity.utcOffsetMinutes * 60 * 1000;
      const dateKey = new Date(activity.startedAt.getTime() + offsetMs).toISOString().slice(0, 10);
      const start = new Date(Date.parse(`${dateKey}T00:00:00Z`) - offsetMs);
      return { start, endExclusive: new Date(start.getTime() + DAY_MS) };
    }
    const timezone = await this.resolveTimezone(activity.athleteId);
    const dateKey = toLocalDateKey(activity.startedAt, timezone);
    return resolveLocalRange(dateKey, dateKey, timezone);
  }

  private async resolveTimezone(athleteId: string): Promise<string> {
    const athlete = await this.athletesService.findById(athleteId);
    if (!athlete) {
      return 'UTC';
    }
    const timezone = (await this.preferencesService.getEntity(athlete.userId)).timezone;
    if (!timezone) {
      return 'UTC';
    }
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private async createSource(activity: RunningActivity, workoutId: string, isPrimary: boolean): Promise<WorkoutSource> {
    return this.sourceModel.create({
      ...this.toSourceAttributes(activity),
      workoutId,
      athleteId: activity.athleteId,
      provider: activity.source,
      sourceActivityId: activity.sourceActivityId,
      isPrimary,
    });
  }

  private toSourceAttributes(activity: RunningActivity): SourceAttributes {
    return {
      originAppId: activity.originAppId ?? null,
      originDevice: activity.originDevice ?? null,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      utcOffsetMinutes: activity.utcOffsetMinutes ?? null,
      durationSec: Math.round(activity.movingTimeSec ?? activity.durationSec),
      distanceMeters: Math.round(activity.distanceMeters),
      facts: this.toFacts(activity),
    };
  }

  private toFacts(activity: RunningActivity): WorkoutSourceFacts {
    return {
      type: activity.type,
      movingTimeSec: activity.movingTimeSec ?? activity.durationSec ?? null,
      elapsedTimeSec: activity.elapsedTimeSec ?? null,
      elevationGainMeters: activity.elevationGainMeters ?? null,
      averageHeartRate: activity.averageHeartRate ?? null,
      maxHeartRate: activity.maxHeartRate ?? null,
      cadence: activity.cadence ?? null,
      calories: activity.calories ?? null,
      gearExternalId: activity.gearExternalId ?? null,
    };
  }

  private toRecord(activity: RunningActivity): SourceRecord {
    const attributes = this.toSourceAttributes(activity);
    return {
      provider: activity.source,
      sourceActivityId: activity.sourceActivityId,
      startedAt: attributes.startedAt,
      endedAt: attributes.endedAt,
      durationSec: attributes.durationSec,
      distanceMeters: attributes.distanceMeters,
      facts: attributes.facts,
      createdAt: new Date(),
    };
  }

  private sourceToRecord(source: WorkoutSource): SourceRecord {
    return {
      provider: source.provider,
      sourceActivityId: source.sourceActivityId,
      startedAt: source.startedAt,
      endedAt: source.endedAt,
      durationSec: source.durationSec,
      distanceMeters: source.distanceMeters,
      facts: source.facts,
      createdAt: source.createdAt,
    };
  }

  private emitImported(athleteId: string, workoutId: string, merged: MergedSourceFacts): void {
    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED,
      new ActivityImportedEvent(
        athleteId,
        workoutId,
        merged.primary.provider,
        merged.primary.sourceActivityId,
        merged.gearExternalId,
      ),
    );
  }

  private emitChanged(
    event: typeof INTEGRATIONS_EVENTS.ACTIVITY_UPDATED | typeof INTEGRATIONS_EVENTS.ACTIVITY_MERGED,
    athleteId: string,
    workoutId: string,
    merged: MergedSourceFacts | null,
  ): void {
    if (!merged) {
      this.logger.warn(`Workout ${workoutId} has no sources after ${event}`);
      return;
    }
    this.eventEmitter.emit(
      event,
      new ActivitySourceChangedEvent(
        athleteId,
        workoutId,
        merged.primary.provider,
        merged.primary.sourceActivityId,
        merged.gearExternalId,
      ),
    );
  }
}
