import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { OpenAiService } from '@/modules/openai/openai.service';
import { provideTrainingServicesMock } from '@/modules/training/testing/training-service-providers';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { COACH_DEFAULT_TITLE } from './coach.constants';
import { CoachPromptBuilder } from './coach.prompt';
import { CoachService } from './coach.service';
import { CoachToolRunner } from './coach.tool-runner';
import { CoachConversationService } from './coach-conversation.service';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';

describe('CoachService', () => {
  let service: CoachService;

  const sessionRecord = {
    id: 'session-1',
    userId: 'user-1',
    athleteId: 'athlete-1',
    title: COACH_DEFAULT_TITLE,
    summary: null,
    model: 'gpt-5',
    lastMessageAt: null,
    createdAt: new Date('2026-09-11T07:00:00.000Z'),
    updatedAt: new Date('2026-09-11T07:00:00.000Z'),
    save: jest.fn(),
  };

  const userMessageRecord = {
    id: 'message-user-1',
    sessionId: sessionRecord.id,
    role: 'user' as const,
    content: 'What should I do this week?',
    toolName: null,
    toolCallId: null,
    metadata: {},
    createdAt: new Date('2026-09-11T07:30:00.000Z'),
    updatedAt: new Date('2026-09-11T07:30:00.000Z'),
  };

  const assistantMessageRecord = {
    id: 'message-assistant-1',
    sessionId: sessionRecord.id,
    role: 'assistant' as const,
    content: 'Keep the next run easy and watch recovery.',
    toolName: null,
    toolCallId: null,
    metadata: {},
    createdAt: new Date('2026-09-11T08:00:00.000Z'),
    updatedAt: new Date('2026-09-11T08:00:00.000Z'),
  };

  const sessionModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
  };

  const messageModel = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  const trainingService = {
    getAthlete: jest.fn(),
    getAthleteState: jest.fn(),
    getLatestGoalForAthlete: jest.fn(),
    getActivePlanForAthlete: jest.fn(),
    listRecentWorkoutsForAthlete: jest.fn(),
    listRecentUserEdits: jest.fn().mockResolvedValue([]),
  };

  const openAiService = {
    createStructuredResponse: jest.fn(),
    getConfiguredModel: jest.fn().mockReturnValue('gpt-5'),
  };

  const promptBuilder = {
    buildInstructions: jest.fn().mockReturnValue('coach instructions'),
    buildContextMessage: jest.fn().mockReturnValue('coach context'),
  };

  const toolRunner = {
    runTools: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sessionRecord.save.mockResolvedValue(sessionRecord);

    sessionModel.create.mockImplementation(async (payload: Record<string, unknown>) => ({
      ...sessionRecord,
      ...payload,
    }));
    sessionModel.findByPk.mockResolvedValue(sessionRecord);

    messageModel.create.mockImplementation(async (payload: Record<string, unknown>) => ({
      ...(payload as object),
      id: payload.role === 'user' ? userMessageRecord.id : assistantMessageRecord.id,
      createdAt: payload.role === 'user' ? userMessageRecord.createdAt : assistantMessageRecord.createdAt,
      updatedAt: payload.role === 'user' ? userMessageRecord.updatedAt : assistantMessageRecord.updatedAt,
    }));
    messageModel.findAll.mockResolvedValue([userMessageRecord]);

    trainingService.getAthlete.mockResolvedValue({
      id: 'athlete-1',
      userId: 'user-1',
      age: 31,
      sex: 'male',
      heightCm: 178,
      weightKg: 74,
      experienceLevel: 'intermediate',
      weeklyMileageKm: 38,
      sessionsPerWeek: 4,
      recentRaceResults: [],
      preferredTrainingDays: ['tuesday', 'thursday', 'saturday'],
      availableTrainingDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
      preferredWorkoutDurationMinutes: 50,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    trainingService.getAthleteState.mockResolvedValue({
      id: 'state-1',
      athleteId: 'athlete-1',
      fitness: 42,
      fatigue: 28,
      form: 14,
      thresholdPaceSecondsPerKm: 270,
      thresholdHeartRate: 168,
      vo2max: 56,
      weeklyLoad: 28,
      acuteLoad: 28,
      chronicLoad: 42,
      recoveryScore: 68,
      confidence: 0.86,
      source: 'deterministic_v1',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    trainingService.getLatestGoalForAthlete.mockResolvedValue(null);
    trainingService.getActivePlanForAthlete.mockResolvedValue(null);
    trainingService.listRecentWorkoutsForAthlete.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        CoachConversationService,
        { provide: getModelToken(CoachSession), useValue: sessionModel },
        { provide: getModelToken(CoachMessage), useValue: messageModel },
        ...provideTrainingServicesMock(trainingService),
        { provide: OpenAiService, useValue: openAiService },
        { provide: CoachPromptBuilder, useValue: promptBuilder },
        { provide: CoachToolRunner, useValue: toolRunner },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CoachPolicyService, useValue: { assertEnabled: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(CoachService);
  });

  it('creates a coaching session for the requested athlete', async () => {
    const result = await service.createSession('user-1', {
      athleteId: 'athlete-1',
      title: 'My coach',
    });

    expect(trainingService.getAthlete).toHaveBeenCalledWith('athlete-1', 'user-1');
    expect(sessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        athleteId: 'athlete-1',
        title: 'My coach',
        model: 'gpt-5',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'coach.session.created',
      expect.objectContaining({
        userId: 'user-1',
        athleteId: 'athlete-1',
        sessionId: 'session-1',
      }),
    );
    expect(result).toMatchObject({
      id: 'session-1',
      athleteId: 'athlete-1',
      title: 'My coach',
      model: 'gpt-5',
    });
  });

  it('sends a message without tool requests and stores the assistant reply', async () => {
    openAiService.createStructuredResponse.mockResolvedValue({
      stage: 'final',
      reply: 'Keep the next run easy and watch recovery.',
      summary: 'Kept the next session conservative.',
      toolRequests: [],
      clarifyingQuestion: null,
      safetyFlags: ['low_fatigue'],
    });

    const result = await service.sendMessage('user-1', 'session-1', {
      message: 'What should I do this week?',
    });

    expect(messageModel.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionId: 'session-1',
        role: 'user',
        content: 'What should I do this week?',
      }),
    );
    expect(openAiService.createStructuredResponse).toHaveBeenCalledTimes(1);
    expect(toolRunner.runTools).not.toHaveBeenCalled();
    expect(messageModel.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Keep the next run easy and watch recovery.',
      }),
    );
    expect(sessionRecord.save).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'coach.reply.generated',
      expect.objectContaining({
        userId: 'user-1',
        athleteId: 'athlete-1',
        sessionId: 'session-1',
        messageId: 'message-assistant-1',
      }),
    );
    expect(result.reply).toBe('Keep the next run easy and watch recovery.');
    expect(result.toolResults).toEqual([]);
  });

  it('executes requested tools before generating the final reply', async () => {
    openAiService.createStructuredResponse
      .mockResolvedValueOnce({
        stage: 'need_tools',
        reply: 'I should inspect the training state first.',
        summary: 'Need context before answering.',
        toolRequests: [
          {
            name: 'getAthleteState',
            arguments: {},
          },
        ],
        clarifyingQuestion: null,
        safetyFlags: [],
      })
      .mockResolvedValueOnce({
        reply: 'Use an easy run and recover.',
        summary: 'Context confirmed a conservative recommendation.',
        safetyFlags: [],
      });
    toolRunner.runTools.mockResolvedValue([
      {
        name: 'get_context',
        input: {},
        output: {
          athlete: { id: 'athlete-1' },
        },
      },
    ]);

    const result = await service.sendMessage('user-1', 'session-1', {
      message: 'Why is this week so light?',
    });

    expect(openAiService.createStructuredResponse).toHaveBeenCalledTimes(2);
    expect(toolRunner.runTools).toHaveBeenCalledWith('user-1', 'athlete-1', [
      {
        name: 'getAthleteState',
        arguments: {},
      },
    ]);
    expect(result.toolResults).toEqual([
      {
        name: 'get_context',
        input: {},
        output: {
          athlete: { id: 'athlete-1' },
        },
      },
    ]);
    expect(result.reply).toBe('Use an easy run and recover.');
  });
});
