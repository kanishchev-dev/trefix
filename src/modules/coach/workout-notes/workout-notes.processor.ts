import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { COACH_WORKOUT_NOTE_JOB, COACH_WORKOUT_NOTE_QUEUE, type CoachWorkoutNoteJob } from './workout-notes.constants';
import { CoachWorkoutNotesService } from './workout-notes.service';

/** Writes coach notes for workouts; the LLM call is too slow for the request itself. */
@Processor(COACH_WORKOUT_NOTE_QUEUE)
export class CoachWorkoutNotesProcessor extends WorkerHost {
  private readonly logger = new Logger(CoachWorkoutNotesProcessor.name);

  constructor(private readonly notesService: CoachWorkoutNotesService) {
    super();
  }

  async process(job: Job<CoachWorkoutNoteJob>): Promise<void> {
    if (job.name === COACH_WORKOUT_NOTE_JOB) {
      await this.notesService.generate(job.data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Coach workout note ${job.id} failed: ${error.message}`, error.stack);
  }
}
