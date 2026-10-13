import type { Queue } from 'bullmq';

import type { OpenAiService } from '@/modules/openai/openai.service';
import type { RealtimeService } from '@/modules/realtime/realtime.service';
import type { GoalsService } from '@/modules/training/goals/goals.service';
import type { WorkoutView } from '@/modules/training/interfaces/training-views.interface';
import type { WorkoutsService } from '@/modules/training/workouts/workouts.service';
import type { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';
import type { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';

import type { CoachWorkoutNote } from './workout-note.entity';
import { workoutNoteInputHash } from './workout-note.prompt';
import type { CoachWorkoutNoteJob } from './workout-notes.constants';
import { CoachWorkoutNotesService } from './workout-notes.service';

describe('CoachWorkoutNotesService', () => {
  const workout = {
    id: 'workout-1',
    athleteId: 'athlete-1',
    goalId: null,
    planId: 'plan-1',
    weekNumber: 1,
    scheduledAt: new Date('2026-10-14T06:00:00Z'),
    type: 'easy',
    phase: 'BASE',
    status: 'planned',
    orderInWeek: 1,
    durationMinutes: 45,
    distanceKm: 6,
    target: { paceMinSecondsPerKm: 360, paceMaxSecondsPerKm: 390 },
    steps: [],
    actual: null,
    analysis: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as WorkoutView;

  type Setup = {
    service: CoachWorkoutNotesService;
    noteModel: { findOne: jest.Mock; create: jest.Mock };
    queue: { add: jest.Mock };
    openAi: { createStructuredResponse: jest.Mock };
    realtime: { emitToUser: jest.Mock };
  };

  const setup = (options: { enabled?: boolean; note?: Partial<CoachWorkoutNote> | null } = {}): Setup => {
    const noteModel = {
      findOne: jest.fn().mockResolvedValue(options.note ?? null),
      create: jest.fn().mockImplementation((values) => Promise.resolve({ id: 'note-1', ...values })),
    };
    const queue = { add: jest.fn() };
    const openAi = {
      createStructuredResponse: jest.fn().mockResolvedValue({ note: '  Лёгкий бег для восстановления.  ' }),
      getConfiguredModel: jest.fn().mockReturnValue('gpt-test'),
    };
    const realtime = { emitToUser: jest.fn() };
    const service = new CoachWorkoutNotesService(
      noteModel as unknown as typeof CoachWorkoutNote,
      queue as unknown as Queue<CoachWorkoutNoteJob>,
      { getWorkout: jest.fn().mockResolvedValue(workout) } as unknown as WorkoutsService,
      { getGoal: jest.fn() } as unknown as GoalsService,
      { isEnabled: jest.fn().mockResolvedValue(options.enabled ?? true) } as unknown as CoachPolicyService,
      { getEntity: jest.fn().mockResolvedValue({ language: 'ru' }) } as unknown as UserPreferencesService,
      openAi as unknown as OpenAiService,
      realtime as unknown as RealtimeService,
      { emit: jest.fn() } as never,
    );
    return { service, noteModel, queue, openAi, realtime };
  };

  const freshHash = workoutNoteInputHash({ workout, goal: null }, 'ru');

  it('returns a stored note written from the current workout data', async () => {
    const updatedAt = new Date('2026-10-13T10:00:00Z');
    const { service, queue } = setup({ note: { content: 'Готово', inputHash: freshHash, updatedAt } });
    await expect(service.getNote('user-1', 'workout-1')).resolves.toEqual({
      workoutId: 'workout-1',
      status: 'ready',
      content: 'Готово',
      generatedAt: updatedAt,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('schedules a rewrite when the workout changed since the note', async () => {
    const { service, queue } = setup({ note: { content: 'Старое', inputHash: 'other' } });
    await expect(service.getNote('user-1', 'workout-1')).resolves.toMatchObject({ status: 'pending', content: null });
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      { userId: 'user-1', workoutId: 'workout-1', language: 'ru' },
      expect.objectContaining({ jobId: 'workout-1_ru', removeOnComplete: true }),
    );
  });

  it('neither returns nor schedules anything while the coach is off', async () => {
    const { service, queue } = setup({ enabled: false });
    await expect(service.getNote('user-1', 'workout-1')).resolves.toMatchObject({ status: 'disabled' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('writes the note in the job and tells the client', async () => {
    const { service, noteModel, realtime } = setup();
    await service.generate({ userId: 'user-1', workoutId: 'workout-1', language: 'ru' });
    expect(noteModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Лёгкий бег для восстановления.', inputHash: freshHash, model: 'gpt-test' }),
    );
    expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'coach.workout_note.ready', { workoutId: 'workout-1' });
  });

  it('skips the LLM when the note is already fresh', async () => {
    const { service, openAi } = setup({ note: { content: 'Готово', inputHash: freshHash } });
    await service.generate({ userId: 'user-1', workoutId: 'workout-1', language: 'ru' });
    expect(openAi.createStructuredResponse).not.toHaveBeenCalled();
  });
});
