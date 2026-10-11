import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Observable } from 'rxjs';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { OpenAiInputMessage } from '@/modules/openai/interfaces/openai-types.interface';
import { OpenAiService } from '@/modules/openai/openai.service';
import { TrainingService } from '@/modules/training/training.service';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

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
    private readonly coachPolicyService: CoachPolicyService,
  ) {}

  /** Creates a coaching session for an athlete. */
  async createSession(userId: string, dto: CreateCoachSessionDto): Promise<CoachSessionResponseDto> {
    await this.coachPolicyService.assertEnabled(userId);
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
    const session = await this.loadSessionOrThrow(userId, sessionId);
    const messages = await this.getMessages(session.id);
    return {
      session: this.toSessionView(session),
      messages: messages.map((message) => this.toMessageView(message)),
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

  /** Sends a message to the coach and returns a stream of generated reply fragments. */
  async streamMessage(
    userId: string,
    sessionId: string,
    dto: SendCoachMessageDto,
  ): Promise<Observable<{ delta?: string; isDone: boolean }>> {
    await this.coachPolicyService.assertEnabled(userId);
    const session = await this.loadSessionOrThrow(userId, sessionId);

    // 1. Record user message
    await this.messageModel.create({
      sessionId: session.id,
      role: 'user',
      content: dto.message,
      toolName: null,
      toolCallId: null,
      metadata: {},
    });

    // 2. Generation Phase
    const context = await this.buildCoachContext(userId, session);
    const history = await this.getMessages(session.id);
    const instructions = this.promptBuilder.buildInstructions();

    return new Observable<{ delta?: string; isDone: boolean }>((subscriber) => {
      let fullReply = '';
      let toolResults: CoachToolExecutionResult[] = [];

      const runGeneration = async (input: OpenAiInputMessage[], isDraft: boolean): Promise<void> => {
        let jsonBuffer = '';
        let lastReplyLength = 0;

        return new Promise<void>((resolve, reject) => {
          this.openAiService
            .streamResponse({
              instructions,
              input,
              schemaName: isDraft ? 'coach_draft' : 'coach_final',
              schema: (isDraft ? COACH_DRAFT_SCHEMA : COACH_FINAL_SCHEMA) as Record<string, unknown>,
              metadata: { module: 'coach', sessionId: session.id },
            })
            .subscribe({
              next: (delta) => {
                if (delta.type === 'text' && delta.delta) {
                  jsonBuffer += delta.delta;

                  // Robust extraction of 'reply' field from JSON stream
                  const replyMatch = jsonBuffer.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
                  if (replyMatch && replyMatch[1]) {
                    try {
                      // Attempting to parse the captured fragment as a JS string to unescape correctly
                      const currentReply = JSON.parse(`"${replyMatch[1]}"`);
                      const newText = currentReply.slice(lastReplyLength);
                      if (newText) {
                        lastReplyLength = currentReply.length;
                        this.logger.debug(`Coach Stream Delta: [${newText}]`);
                        subscriber.next({ delta: newText, isDone: false });
                      }
                    } catch {
                      // If JSON.parse fails (e.g. partial escape sequence like \n), try manual cleanup for immediate output
                      const rawReply = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                      const newText = rawReply.slice(lastReplyLength);
                      if (newText && !newText.endsWith('\\')) {
                        // Don't yield if it might be a partial escape
                        lastReplyLength = rawReply.length;
                        subscriber.next({ delta: newText, isDone: false });
                      }
                    }
                  }
                }
              },
              error: (err) => reject(err),
              complete: async () => {
                try {
                  const parsed = JSON.parse(jsonBuffer);
                  if (isDraft) {
                    const currentDraft = parsed as CoachDraftResponse;
                    if (currentDraft.stage === 'need_clarification') {
                      const msg = currentDraft.clarifyingQuestion || currentDraft.reply || '';
                      const remaining = msg.slice(lastReplyLength);
                      if (remaining) {
                        subscriber.next({ delta: remaining, isDone: false });
                      }
                      fullReply = msg;
                      resolve();
                    } else if (currentDraft.toolRequests && currentDraft.toolRequests.length > 0) {
                      toolResults = await this.toolRunner.runTools(
                        userId,
                        session.athleteId,
                        currentDraft.toolRequests,
                      );
                      const finalInput = this.buildFinalPromptMessages(
                        context,
                        history,
                        dto.message,
                        currentDraft,
                        toolResults,
                      );
                      await runGeneration(finalInput, false);
                      resolve();
                    } else {
                      fullReply = currentDraft.reply || '';
                      const remaining = fullReply.slice(lastReplyLength);
                      if (remaining) {
                        subscriber.next({ delta: remaining, isDone: false });
                      }
                      resolve();
                    }
                  } else {
                    const finalResp = parsed as CoachFinalResponse;
                    fullReply = finalResp.reply || '';
                    const remaining = fullReply.slice(lastReplyLength);
                    if (remaining) {
                      subscriber.next({ delta: remaining, isDone: false });
                    }
                    resolve();
                  }
                } catch (e) {
                  this.logger.error(`Failed to parse OpenAI stream final JSON: ${jsonBuffer.slice(-100)}`, e);
                  resolve();
                }
              },
            });
        });
      };

      const start = async (): Promise<void> => {
        try {
          const initialInput = this.buildPromptMessages(context, history, dto.message);
          await runGeneration(initialInput, true);

          // 3. Finalize session & message
          const assistantMessage = await this.messageModel.create({
            sessionId: session.id,
            role: 'assistant',
            content: fullReply,
            metadata: { toolResults, isStreamed: true },
          });

          session.lastMessageAt = new Date();
          if (!session.title || session.title === COACH_DEFAULT_TITLE) {
            session.title = this.deriveTitle(dto.message, fullReply);
          }
          await session.save();

          this.eventEmitter.emit(
            'coach.reply.generated',
            new CoachReplyGeneratedEvent(userId, session.athleteId, session.id, assistantMessage.id),
          );

          subscriber.next({ isDone: true });
          subscriber.complete();
        } catch (error) {
          this.logger.error('Streaming failed', error);
          subscriber.error(error);
        }
      };

      start();
    });
  }

  /** Sends a message to the coach and returns the generated reply. */
  async sendMessage(userId: string, sessionId: string, dto: SendCoachMessageDto): Promise<CoachChatResponseDto> {
    await this.coachPolicyService.assertEnabled(userId);
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
    // The coach works with the plan in work, not with the latest created row.
    const plan = await this.trainingService.getActivePlanForAthlete(session.athleteId, userId);
    const recentWorkouts = await this.trainingService.listRecentWorkoutsForAthlete(session.athleteId, userId);
    const recentPlanEdits = plan ? await this.trainingService.listRecentUserEdits(plan.id) : [];

    return {
      session: this.toSessionView(session),
      athlete,
      state,
      goal,
      plan,
      recentPlanEdits,
      recentWorkouts,
      recentMessages: await this.getRecentMessageViews(session.id),
    };
  }

  private buildPromptMessages(
    context: CoachContextInput,
    history: CoachMessage[],
    currentUserMessage: string,
    toolResults?: CoachToolExecutionResult[],
  ): Array<{
    role: 'system' | 'developer' | 'user' | 'assistant';
    content: Array<{ type: 'input_text' | 'output_text'; text: string }>;
  }> {
    const systemContent = this.promptBuilder.buildContextMessage(context);
    const toolContent = toolResults?.length ? `\n\nTool Results:\n${JSON.stringify(toolResults, null, 2)}` : '';

    const messages: Array<{
      role: 'system' | 'developer' | 'user' | 'assistant';
      content: Array<{ type: 'input_text' | 'output_text'; text: string }>;
    }> = [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemContent + toolContent }],
      },
    ];

    history.slice(-12).forEach((message) => {
      // Skip tool messages in prompt as they are merged into system or developer
      if (message.role === 'tool') return;

      messages.push({
        role: message.role,
        content: [
          {
            type: message.role === 'assistant' ? 'output_text' : 'input_text',
            text: message.content,
          },
        ],
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
    content: Array<{ type: 'input_text' | 'output_text'; text: string }>;
  }> {
    // Merge tool results into a more robust context-aware prompt
    return this.buildPromptMessages(context, history, currentUserMessage, toolResults);
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
