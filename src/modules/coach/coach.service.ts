import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import { OpenAiService } from '@/modules/openai/openai.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { COACH_DEFAULT_TITLE } from './coach.constants';
import { CoachDraftResponse, CoachFinalResponse, CoachToolExecutionResult } from './coach.interfaces';
import { toCoachMessageView, toCoachSessionView } from './coach.mappers';
import { COACH_DRAFT_SCHEMA, COACH_FINAL_SCHEMA } from './coach.schemas';
import { CoachToolRunner } from './coach.tool-runner';
import { CoachConversationService, CoachTurn } from './coach-conversation.service';
import { CoachChatResponseDto, CoachSessionDetailResponseDto, CoachSessionResponseDto } from './dto/coach-response.dto';
import { CreateCoachSessionDto } from './dto/create-coach-session.dto';
import { SendCoachMessageDto } from './dto/send-coach-message.dto';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';
import { CoachSessionCreatedEvent } from './events/coach-session-created.event';

/** Coach sessions and the blocking (non-streaming) chat. */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    @InjectModel(CoachSession)
    private readonly sessionModel: typeof CoachSession,
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
    private readonly conversation: CoachConversationService,
    private readonly athletesService: AthletesService,
    private readonly openAiService: OpenAiService,
    private readonly toolRunner: CoachToolRunner,
    private readonly eventEmitter: EventEmitter2,
    private readonly coachPolicyService: CoachPolicyService,
  ) {}

  /** Creates a coaching session for an athlete. */
  async createSession(userId: string, dto: CreateCoachSessionDto): Promise<CoachSessionResponseDto> {
    await this.coachPolicyService.assertEnabled(userId);
    const athlete = await this.athletesService.getAthlete(dto.athleteId, userId);
    const session = await this.sessionModel.create({
      userId,
      athleteId: athlete.id,
      title: dto.title ?? COACH_DEFAULT_TITLE,
      summary: null,
      model: this.openAiService.getConfiguredModel(),
      lastMessageAt: null,
    });

    this.eventEmitter.emit(COACH_EVENTS.SESSION_CREATED, new CoachSessionCreatedEvent(userId, athlete.id, session.id));
    return toCoachSessionView(session);
  }

  /**
   * Clears the chat history: soft-deletes every session of the user with its
   * messages. Allowed while the coach is off. Plans and workouts are untouched.
   */
  async clearHistory(userId: string): Promise<void> {
    const sessions = await this.sessionModel.findAll({ where: { userId }, attributes: ['id'] });
    const sessionIds = sessions.map((session) => session.id);
    if (sessionIds.length === 0) {
      return;
    }
    await this.sessionModel.sequelize!.transaction(async (transaction) => {
      await this.messageModel.destroy({ where: { sessionId: sessionIds }, transaction });
      await this.sessionModel.destroy({ where: { id: sessionIds }, transaction });
    });
  }

  /** Returns a coaching session and its message history. */
  async getSession(userId: string, sessionId: string): Promise<CoachSessionDetailResponseDto> {
    const session = await this.conversation.loadSessionOrThrow(userId, sessionId);
    const messages = await this.conversation.getMessages(session.id);
    return {
      session: toCoachSessionView(session),
      messages: messages.map(toCoachMessageView),
    };
  }

  /** Returns the latest coaching session and its message history. */
  async getLatestSession(userId: string): Promise<CoachSessionDetailResponseDto> {
    const session = await this.sessionModel.findOne({
      where: { userId },
      order: [
        ['lastMessageAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    if (!session) {
      throw new EntityNotFoundException('CoachSession', 'latest');
    }

    return this.getSession(userId, session.id);
  }

  /** Sends a message to the coach and returns the generated reply. */
  async sendMessage(userId: string, sessionId: string, dto: SendCoachMessageDto): Promise<CoachChatResponseDto> {
    const turn = await this.conversation.openTurn(userId, sessionId, dto.message);
    const draft = await this.openAiService.createStructuredResponse<CoachDraftResponse>({
      instructions: this.conversation.instructions(),
      input: this.conversation.promptMessages(turn),
      schemaName: 'coach_draft',
      schema: COACH_DRAFT_SCHEMA as Record<string, unknown>,
      metadata: { module: 'coach', sessionId: turn.session.id },
    });

    const { finalResponse, toolResults } = await this.resolveFinal(userId, turn, draft);
    const assistantMessage = await this.conversation.closeTurn(userId, turn, {
      reply: finalResponse.reply,
      summary: finalResponse.summary,
      metadata: { summary: finalResponse.summary, safetyFlags: finalResponse.safetyFlags, draft, toolResults },
    });
    this.logger.debug(`Coach reply generated for session ${turn.session.id}`);

    return {
      session: toCoachSessionView(turn.session),
      assistantMessage: toCoachMessageView(assistantMessage),
      reply: finalResponse.reply,
      coachSummary: finalResponse.summary,
      toolResults: toolResults.map((result) => ({
        name: result.name,
        input: result.input,
        output: result.output,
      })),
    };
  }

  /** The draft is final unless it requested tools; then a second pass sees their results. */
  private async resolveFinal(
    userId: string,
    turn: CoachTurn,
    draft: CoachDraftResponse,
  ): Promise<{ finalResponse: CoachFinalResponse; toolResults: CoachToolExecutionResult[] }> {
    if (draft.stage === 'need_clarification') {
      return {
        finalResponse: {
          reply: draft.clarifyingQuestion || draft.reply,
          summary: draft.summary,
          safetyFlags: draft.safetyFlags,
        },
        toolResults: [],
      };
    }
    if (draft.toolRequests.length === 0) {
      return {
        finalResponse: { reply: draft.reply, summary: draft.summary, safetyFlags: draft.safetyFlags },
        toolResults: [],
      };
    }

    const toolResults = await this.toolRunner.runTools(userId, turn.session.athleteId, draft.toolRequests);
    const finalResponse = await this.openAiService.createStructuredResponse<CoachFinalResponse>({
      instructions: this.conversation.instructions(),
      input: this.conversation.promptMessages(turn, toolResults),
      schemaName: 'coach_final',
      schema: COACH_FINAL_SCHEMA as Record<string, unknown>,
      metadata: { module: 'coach', sessionId: turn.session.id },
    });
    return { finalResponse, toolResults };
  }
}
