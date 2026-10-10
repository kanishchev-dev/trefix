import { Injectable } from '@nestjs/common';

import type { ImportedWorkoutFacts } from '../../training/interfaces/imported-workout.interface';
import { ACTIVITY_DEDUP, ACTIVITY_SOURCE_PRIORITY } from '../constants/integrations.constants';
import type { WorkoutSourceFacts } from '../entities/workout-source.entity';
import type { ActivitySource } from '../interfaces/running-activity.interface';

/** The part of a source record that dedup and merge work with. */
export interface SourceRecord {
  provider: ActivitySource;
  sourceActivityId: string;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  distanceMeters: number;
  facts: WorkoutSourceFacts;
  createdAt?: Date;
}

export interface MergedSourceFacts {
  primary: SourceRecord;
  facts: ImportedWorkoutFacts;
  gearExternalId: string | null;
}

/** Pure rules deciding which records describe the same run and how their facts combine. */
@Injectable()
export class ActivityDedupService {
  /** Share of the shorter record covered by the intersection of both time ranges (0..1). */
  overlapRatio(a: Pick<SourceRecord, 'startedAt' | 'endedAt'>, b: Pick<SourceRecord, 'startedAt' | 'endedAt'>): number {
    const start = Math.max(a.startedAt.getTime(), b.startedAt.getTime());
    const end = Math.min(a.endedAt.getTime(), b.endedAt.getTime());
    const intersection = Math.max(0, end - start);
    const shorter = Math.min(a.endedAt.getTime() - a.startedAt.getTime(), b.endedAt.getTime() - b.startedAt.getTime());
    return shorter > 0 ? intersection / shorter : 0;
  }

  isSameRun(a: SourceRecord, b: SourceRecord): boolean {
    if (this.overlapRatio(a, b) < ACTIVITY_DEDUP.minOverlapRatio) {
      return false;
    }
    if (Math.abs(a.startedAt.getTime() - b.startedAt.getTime()) > ACTIVITY_DEDUP.maxStartDiffSec * 1000) {
      return false;
    }
    const allowedDiff = Math.max(
      ACTIVITY_DEDUP.maxDistanceDiffMeters,
      Math.max(a.distanceMeters, b.distanceMeters) * ACTIVITY_DEDUP.maxDistanceDiffRatio,
    );
    return Math.abs(a.distanceMeters - b.distanceMeters) <= allowedDiff;
  }

  /** Candidate with the largest overlap among those that are the same run; candidates of the same provider are ignored. */
  findDuplicate<T extends SourceRecord>(record: SourceRecord, candidates: T[]): T | null {
    let best: T | null = null;
    let bestOverlap = -1;
    for (const candidate of candidates) {
      if (candidate.provider === record.provider || !this.isSameRun(record, candidate)) {
        continue;
      }
      const overlap = this.overlapRatio(record, candidate);
      if (overlap > bestOverlap) {
        best = candidate;
        bestOverlap = overlap;
      }
    }
    return best;
  }

  /** Sources by priority; ties go to the record seen first. */
  orderByPriority<T extends SourceRecord>(sources: T[]): T[] {
    const rank = (provider: string): number => {
      const index = ACTIVITY_SOURCE_PRIORITY.indexOf(provider as (typeof ACTIVITY_SOURCE_PRIORITY)[number]);
      return index === -1 ? ACTIVITY_SOURCE_PRIORITY.length : index;
    };
    return [...sources].sort((a, b) => {
      const byRank = rank(a.provider) - rank(b.provider);
      if (byRank !== 0) {
        return byRank;
      }
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    });
  }

  /**
   * Facts of the primary source, with gaps filled from the other sources in
   * priority order. Time range, duration and distance always come from the primary.
   */
  merge(sources: SourceRecord[]): MergedSourceFacts {
    if (sources.length === 0) {
      throw new Error('Cannot merge an empty source list');
    }
    const ordered = this.orderByPriority(sources);
    const [primary] = ordered;
    const pick = <K extends keyof WorkoutSourceFacts>(key: K): WorkoutSourceFacts[K] | null => {
      for (const source of ordered) {
        const value = source.facts?.[key];
        if (value !== null && value !== undefined) {
          return value;
        }
      }
      return null;
    };

    const movingTimeSec = primary.facts?.movingTimeSec ?? primary.durationSec;
    const distanceKm = Math.round(primary.distanceMeters / 100) / 10;
    const type = primary.facts?.type ?? 'run';

    return {
      primary,
      gearExternalId: pick('gearExternalId'),
      facts: {
        sourceProvider: primary.provider,
        sourceActivityId: primary.sourceActivityId,
        startedAt: primary.startedAt,
        endedAt: primary.endedAt,
        durationMinutes: Math.max(1, Math.round(movingTimeSec / 60)),
        distanceKm,
        averagePaceSecondsPerKm:
          primary.distanceMeters > 0 ? Math.round((movingTimeSec / primary.distanceMeters) * 1000) : null,
        averageHeartRate: pick('averageHeartRate'),
        maxHeartRate: pick('maxHeartRate'),
        cadence: pick('cadence'),
        calories: pick('calories'),
        elevationGainMeters: pick('elevationGainMeters'),
        indoor: type === 'treadmill' || type === 'virtual_run',
      },
    };
  }
}
