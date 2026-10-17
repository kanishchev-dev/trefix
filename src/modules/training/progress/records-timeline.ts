import { RECORD_DISTANCES, type RecordDistance } from '../training.constants';
import { type Effort, timeForDistance } from './progress-calculations';

/** One moment an athlete set a new best on a record distance. */
export interface RecordImprovement {
  distance: RecordDistance;
  seconds: number;
  /** Best before this effort; null when it is the first result on the distance. */
  previousSeconds: number | null;
  achievedAt: Date;
  workoutId: string | null;
  resultId: string | null;
}

/**
 * Every improvement of personal records in chronological order, using the same
 * rules as the records screen (`bestRecords`). Efforts must be sorted by date,
 * as `toEfforts` returns them.
 */
export function recordTimeline(efforts: readonly Effort[]): RecordImprovement[] {
  const best = new Map<RecordDistance, number>();
  const timeline: RecordImprovement[] = [];
  for (const effort of efforts) {
    if (effort.vdot === null) continue;
    for (const [distance, meters] of Object.entries(RECORD_DISTANCES) as Array<[RecordDistance, number]>) {
      const seconds = timeForDistance(effort, meters);
      if (seconds === null) continue;
      const previous = best.get(distance) ?? null;
      if (previous !== null && seconds >= previous) continue;
      best.set(distance, seconds);
      timeline.push({
        distance,
        seconds,
        previousSeconds: previous,
        achievedAt: effort.date,
        workoutId: effort.workoutId,
        resultId: effort.resultId,
      });
    }
  }
  return timeline;
}
