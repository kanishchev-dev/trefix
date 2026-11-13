import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { RecordsTimelineService } from '@/modules/training/progress/records-timeline.service';

import { AthleteRecordLog } from '../entities/athlete-record-log.entity';

export interface RecordsJobData {
  athleteId?: string;
  userId?: string;
}

/**
 * Keeps the personal records log in sync with the athlete's history. The
 * whole timeline is recomputed and inserted with ON CONFLICT DO NOTHING, so
 * a job is idempotent and also serves as the backfill.
 */
@Injectable()
export class RecordsLogService {
  constructor(
    @InjectModel(AthleteRecordLog) private readonly logModel: typeof AthleteRecordLog,
    private readonly timelineService: RecordsTimelineService,
  ) {}

  /** Returns the number of record moments checked (existing ones are skipped by the database). */
  async refresh(job: RecordsJobData): Promise<number> {
    const athleteId = job.athleteId ?? (job.userId ? await this.timelineService.athleteIdOfUser(job.userId) : null);
    if (!athleteId) return 0;
    const timeline = await this.timelineService.timelineForAthlete(athleteId);
    if (timeline.length === 0) return 0;
    const created = await this.logModel.bulkCreate(
      timeline.map((entry) => ({
        athleteId,
        workoutId: entry.workoutId,
        raceResultId: entry.resultId,
        distance: entry.distance,
        timeSeconds: entry.seconds,
        previousSeconds: entry.previousSeconds,
        achievedAt: entry.achievedAt,
      })),
      { ignoreDuplicates: true },
    );
    return created.length;
  }
}
