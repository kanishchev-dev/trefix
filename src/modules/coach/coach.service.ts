import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { OpenAiService } from '@/modules/openai/openai.service';
import { TrainingService } from '@/modules/training/training.service';

import { COACH_DEFAULT_TITLE } from './coach.constants';
import { CoachDraftResponse, CoachFinalResponse, CoachToolExecutionResult } from './coach.interfaces';
import { CoachContextInput, CoachPromptBuilder } from './coach.prompt';
import { COACH_DRAFT_SCHEMA, COACH_FINAL_SCHEMA } from './coach.schemas';
import { CoachToolRunner } from './coach.tool-runner';
import {
  CoachChatResponseDto,
  CoachMessageResponseDto,
  CoachSessionDetailResponseDto,
  CoachSessionResponseDto,
} from './dto/coach-response.dto';
import { CreateCoachSessionDto } from './dto/create-coach-session.dto';
import { SendCoachMessageDto } from './dto/send-coach-message.dto';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';
import { CoachReplyGeneratedEvent } from './events/coach-reply-generated.event';
import { CoachSessionCreatedEvent } from './events/coach-session-created.event';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    @InjectModel(CoachSession)
    private readonly sessionModel: typeof CoachSession,
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
    private readonly trainingService: TrainingService,
    private readonly openAiService: OpenAiService,
    private readonly promptBuilder: CoachPromptBuilder,
    private readonly toolRunner: CoachToolRunner,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Creates a coaching session for an athlete. */
  async createSession(userId: string, dto: CreateCoachSessionDto): Promise<CoachSessionResponseDto> {
    const athlete = await this.trainingService.getAthlete(dto.athleteId, userId);
    const session = await this.sessionModel.create({
      userId,
      athleteId: athlete.id,
      title: dto.title ?? COACH_DEFAULT_TITLE,
      summary: null,
      model: this.openAiService.getConfiguredModel(),
      lastMessageAt: null,
    });

    this.eventEmitter.emit('coach.session.created', new CoachSessionCreatedEvent(userId, athlete.id, session.id));
    return this.toSessionView(session);
  }

  /** Returns a coaching session and its message history. */
  async getSession(userId: string, sessionId: string): Promise<CoachSessionDetailResponseDto> {
    const session = await this.loadSessionOrThrow(userId, sessionId);
    const messages = await this.getMessages(session.id);
    return {
      session: this.toSessionView(session),
      messages: messages.map((message) => this.toMessageView(message)),
    };
  }

  /** Sends a message to the coach and returns the generated reply. */
  async sendMessage(userId: string, sessionId: string, dto: SendCoachMessageDto): Promise<CoachChatResponseDto> {
    const session = await this.loadSessionOrThrow(userId, sessionId);
    await this.messageModel.create({
      sessionId: session.id,
      role: 'user',
      content: dto.message,
      toolName: null,
      toolCallId: null,
      metadata: {},
    });

    const context = await this.buildCoachContext(userId, session);
    const history = await this.getMessages(session.id);
    const draft = await this.openAiService.createStructuredResponse<CoachDraftResponse>({
      instructions: this.promptBuilder.buildInstructions(),
      input: this.buildPromptMessages(context, history, dto.message),
      schemaName: 'coach_draft',
      schema: COACH_DRAFT_SCHEMA as Record<string, unknown>,
      metadata: {
        module: 'coach',
        sessionId: session.id,
      },
    });

    let finalResponse: CoachFinalResponse;
    let toolResults: CoachToolExecutionResult[] = [];

    if (draft.stage === 'need_clarification') {
      finalResponse = {
        reply: draft.clarifyingQuestion || draft.reply,
        summary: draft.summary,
        safetyFlags: draft.safetyFlags,
      };
    } else if (draft.toolRequests.length > 0) {
      toolResults = await this.toolRunner.runTools(userId, session.athleteId, draft.toolRequests);
      finalResponse = await this.openAiService.createStructuredResponse<CoachFinalResponse>({
        instructions: this.promptBuilder.buildInstructions(),
        input: this.buildFinalPromptMessages(context, history, dto.message, draft, toolResults),
        schemaName: 'coach_final',
        schema: COACH_FINAL_SCHEMA as Record<string, unknown>,
        metadata: {
          module: 'coach',
          sessionId: session.id,
        },
      });
    } else {
      finalResponse = {
        reply: draft.reply,
        summary: draft.summary,
        safetyFlags: draft.safetyFlags,
      };
    }

    const assistantMessage = await this.messageModel.create({
      sessionId: session.id,
      role: 'assistant',
      content: finalResponse.reply,
      toolName: null,
      toolCallId: null,
      metadata: {
        summary: finalResponse.summary,
        safetyFlags: finalResponse.safetyFlags,
        draft,
        toolResults,
      },
    });

    session.summary = finalResponse.summary;
    session.lastMessageAt = new Date();
    if (!session.title || session.title === COACH_DEFAULT_TITLE) {
      session.title = this.deriveTitle(dto.message, finalResponse.reply);
    }
    await session.save();

    this.eventEmitter.emit(
      'coach.reply.generated',
      new CoachReplyGeneratedEvent(userId, session.athleteId, session.id, assistantMessage.id),
    );

    this.logger.debug(`Coach reply generated for session ${session.id}`);

    return {
      session: this.toSessionView(session),
      assistantMessage: this.toMessageView(assistantMessage),
      reply: finalResponse.reply,
      coachSummary: finalResponse.summary,
      toolResults: toolResults.map((result) => ({
        name: result.name,
        input: result.input,
        output: result.output,
      })),
    };
  }

  private async buildCoachContext(userId: string, session: CoachSession): Promise<CoachContextInput> {
    const athlete = await this.trainingService.getAthlete(session.athleteId, userId);
    const state = await this.trainingService.getAthleteState(session.athleteId, userId);
    const goal = await this.trainingService.getLatestGoalForAthlete(session.athleteId, userId);
    const plan = await this.trainingService.getLatestPlanForAthlete(session.athleteId, userId);
    const recentWorkouts = await this.trainingService.listRecentWorkoutsForAthlete(session.athleteId, userId);

    return {
      session: this.toSessionView(session),
      athlete,
      state,
      goal,
      plan,
      recentWorkouts,
      recentMessages: await this.getRecentMessageViews(session.id),
    };
  }

  private buildPromptMessages(
    context: CoachContextInput,
    history: CoachMessage[],
    currentUserMessage: string,
  ): Array<{
    role: 'system' | 'developer' | 'user' | 'assistant';
    content: Array<{ type: 'input_text'; text: string }>;
  }> {
    const messages: Array<{
      role: 'system' | 'developer' | 'user' | 'assistant';
      content: Array<{ type: 'input_text'; text: string }>;
    }> = [
      {
        role: 'system',
        content: [{ type: 'input_text', text: this.promptBuilder.buildContextMessage(context) }],
      },
    ];

    history.slice(-8).forEach((message) => {
      messages.push({
        role: message.role === 'tool' ? 'developer' : message.role,
        content: [{ type: 'input_text', text: message.content }],
      });
    });

    messages.push({
      role: 'user',
      content: [{ type: 'input_text', text: currentUserMessage }],
    });

    return messages;
  }

  private buildFinalPromptMessages(
    context: CoachContextInput,
    history: CoachMessage[],
    currentUserMessage: string,
    draft: CoachDraftResponse,
    toolResults: CoachToolExecutionResult[],
  ): Array<{
    role: 'system' | 'developer' | 'user' | 'assistant';
    content: Array<{ type: 'input_text'; text: string }>;
  }> {
    const messages = this.buildPromptMessages(context, history, currentUserMessage);
    messages.splice(1, 0, {
      role: 'developer',
      content: [
        {
          type: 'input_text',
          text: JSON.stringify(
            {
              draft,
              toolResults,
            },
            null,
            2,
          ),
        },
      ],
    });

    return messages;
  }

  private async getMessages(sessionId: string): Promise<CoachMessage[]> {
    return this.messageModel.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
      limit: 50,
    });
  }

  private async getRecentMessageViews(sessionId: string): Promise<CoachMessageResponseDto[]> {
    const messages = await this.messageModel.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
      limit: 12,
    });

    return messages.map((message) => this.toMessageView(message));
  }

  private async loadSessionOrThrow(userId: string, sessionId: string): Promise<CoachSession> {
    const session = await this.sessionModel.findByPk(sessionId);
    if (!session || session.userId !== userId) {
      throw new EntityNotFoundException('CoachSession', sessionId);
    }

    return session;
  }

  private toSessionView(session: CoachSession): CoachSessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      athleteId: session.athleteId,
      title: session.title,
      summary: session.summary,
      model: session.model,
      lastMessageAt: session.lastMessageAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private toMessageView(message: CoachMessage): CoachMessageResponseDto {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolCallId: message.toolCallId,
      metadata: message.metadata,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private deriveTitle(userMessage: string, reply: string): string {
    const candidate = `${userMessage} ${reply}`.trim().slice(0, 80);
    return candidate || COACH_DEFAULT_TITLE;
  }
}
