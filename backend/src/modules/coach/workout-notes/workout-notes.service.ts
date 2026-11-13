import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';

import { OpenAiService } from '@/modules/openai/openai.service';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { GoalsService } from '@/modules/training/goals/goals.service';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';
import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import { type PreferenceLanguage } from '@/modules/users/users.constants';

import { COACH_EVENTS } from '../coach.events';
import { CoachWorkoutNoteResponseDto } from '../dto/coach-workout-note-response.dto';
import { CoachWorkoutNoteGeneratedEvent } from '../events/coach-workout-note-generated.event';
import { CoachWorkoutNote } from './workout-note.entity';
import {
  COACH_WORKOUT_NOTE_SCHEMA,
  type CoachWorkoutNoteDraft,
  type WorkoutNoteContext,
  workoutNoteInput,
  workoutNoteInputHash,
  workoutNoteInstructions,
} from './workout-note.prompt';
import {
  COACH_WORKOUT_NOTE_JOB,
  COACH_WORKOUT_NOTE_MAX_LENGTH,
  COACH_WORKOUT_NOTE_QUEUE,
  COACH_WORKOUT_NOTE_READY_EVENT,
  type CoachWorkoutNoteJob,
} from './workout-notes.constants';

/** Same fallback as other texts written outside a request: the product's primary audience. */
const NOTE_FALLBACK_LANGUAGE: PreferenceLanguage = 'ru';

/**
 * The coach's note under a workout. Written by the LLM in a queue job (it takes
 * seconds), stored per workout and language, and rewritten only when the workout
 * data it was written from changes.
 */
@Injectable()
export class CoachWorkoutNotesService {
  private readonly logger = new Logger(CoachWorkoutNotesService.name);

  constructor(
    @InjectModel(CoachWorkoutNote)
    private readonly noteModel: typeof CoachWorkoutNote,
    @InjectQueue(COACH_WORKOUT_NOTE_QUEUE)
    private readonly queue: Queue<CoachWorkoutNoteJob>,
    private readonly workoutsService: WorkoutsService,
    private readonly goalsService: GoalsService,
    private readonly coachPolicyService: CoachPolicyService,
    private readonly preferencesService: UserPreferencesService,
    private readonly openAiService: OpenAiService,
    private readonly realtimeService: RealtimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Returns the stored note, or schedules writing it and answers `pending`. */
  async getNote(userId: string, workoutId: string): Promise<CoachWorkoutNoteResponseDto> {
    const context = await this.loadContext(userId, workoutId);
    if (!(await this.coachPolicyService.isEnabled(userId))) {
      return { workoutId, status: 'disabled', content: null, generatedAt: null };
    }

    const language = await this.languageOf(userId);
    const note = await this.noteModel.findOne({ where: { workoutId, language } });
    if (note && note.inputHash === workoutNoteInputHash(context, language)) {
      return { workoutId, status: 'ready', content: note.content, generatedAt: note.updatedAt };
    }

    await this.queue.add(
      COACH_WORKOUT_NOTE_JOB,
      { userId, workoutId, language },
      {
        // One job per workout and language at a time: repeated requests while it runs don't pile up.
        // Finished jobs are dropped so the id is free for the next change (BullMQ ignores known ids).
        jobId: `${workoutId}_${language}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return { workoutId, status: 'pending', content: null, generatedAt: null };
  }

  /** Job body: writes the note unless it is already fresh or the coach was switched off meanwhile. */
  async generate(job: CoachWorkoutNoteJob): Promise<void> {
    if (!(await this.coachPolicyService.isEnabled(job.userId))) {
      return;
    }
    const context = await this.loadContext(job.userId, job.workoutId);
    const inputHash = workoutNoteInputHash(context, job.language);
    const existing = await this.noteModel.findOne({ where: { workoutId: job.workoutId, language: job.language } });
    if (existing?.inputHash === inputHash) {
      this.notifyReady(job.userId, job.workoutId);
      return;
    }

    const draft = await this.openAiService.createStructuredResponse<CoachWorkoutNoteDraft>({
      instructions: workoutNoteInstructions(job.language),
      input: workoutNoteInput(context),
      schemaName: 'coach_workout_note',
      schema: COACH_WORKOUT_NOTE_SCHEMA,
      strict: true,
      usage: { feature: 'workout_note', userId: job.userId },
    });
    const content = draft.note.trim().slice(0, COACH_WORKOUT_NOTE_MAX_LENGTH);
    const model = this.openAiService.getConfiguredModel();

    const note = existing
      ? await existing.update({ content, inputHash, model })
      : await this.noteModel.create({
          userId: job.userId,
          workoutId: job.workoutId,
          language: job.language,
          inputHash,
          content,
          model,
        });

    this.eventEmitter.emit(
      COACH_EVENTS.WORKOUT_NOTE_GENERATED,
      new CoachWorkoutNoteGeneratedEvent(job.userId, job.workoutId, note.id, job.language),
    );
    this.notifyReady(job.userId, job.workoutId);
    this.logger.log(`Coach note written for workout ${job.workoutId} (${job.language})`);
  }

  private notifyReady(userId: string, workoutId: string): void {
    this.realtimeService.emitToUser(userId, COACH_WORKOUT_NOTE_READY_EVENT, { workoutId });
  }

  /** Also the ownership check: `getWorkout` throws for a workout of another user. */
  private async loadContext(userId: string, workoutId: string): Promise<WorkoutNoteContext> {
    const workout = await this.workoutsService.getWorkout(workoutId, userId);
    const goal = workout.goalId ? await this.goalsService.getGoal(workout.goalId, userId).catch(() => null) : null;
    return { workout, goal };
  }

  private async languageOf(userId: string): Promise<PreferenceLanguage> {
    return (await this.preferencesService.getEntity(userId)).language ?? NOTE_FALLBACK_LANGUAGE;
  }
}
