import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import { OpenAiInputMessage } from '@/modules/openai/interfaces/openai-types.interface';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GoalsService } from '@/modules/training/goals/goals.service';
import { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';
import { type CoachTone } from '@/modules/users/users.constants';

import { COACH_DEFAULT_TITLE } from './coach.constants';
import { CoachToolExecutionResult } from './coach.interfaces';
import { deriveCoachTitle, toCoachMessageView, toCoachSessionView } from './coach.mappers';
import { CoachContextInput, CoachPromptBuilder } from './coach.prompt';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';
import { CoachReplyGeneratedEvent } from './events/coach-reply-generated.event';

/** Messages kept in the prompt; older history is represented by the session summary. */
const PROMPT_HISTORY_SIZE = 12;
const HISTORY_LOAD_LIMIT = 50;

/** Everything a reply is generated from. */
export interface CoachTurn {
  session: CoachSession;
  context: CoachContextInput;
  history: CoachMessage[];
  userMessage: string;
  tone: CoachTone;
}

export interface CoachReplyRecord {
  reply: string;
  summary?: string;
  metadata: Record<string, unknown>;
}

/**
 * Session storage and prompt assembly shared by the blocking and the
 * streaming chat: opens a turn (stores the user message, gathers context)
 * and closes it (stores the reply, updates the session, emits the event).
 */
@Injectable()
export class CoachConversationService {
  constructor(
    @InjectModel(CoachSession)
    private readonly sessionModel: typeof CoachSession,
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
    private readonly athletesService: AthletesService,
    private readonly goalsService: GoalsService,
    private readonly planQueryService: PlanQueryService,
    private readonly workoutsService: WorkoutsService,
    private readonly promptBuilder: CoachPromptBuilder,
    private readonly coachPolicyService: CoachPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async loadSessionOrThrow(userId: string, sessionId: string): Promise<CoachSession> {
    const session = await this.sessionModel.findByPk(sessionId);
    if (!session || session.userId !== userId) {
      throw new EntityNotFoundException('CoachSession', sessionId);
    }
    return session;
  }

  async getMessages(sessionId: string): Promise<CoachMessage[]> {
    return this.messageModel.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
      limit: HISTORY_LOAD_LIMIT,
    });
  }

  /** Checks the coach is enabled, stores the user message and gathers the prompt context. */
  async openTurn(userId: string, sessionId: string, userMessage: string): Promise<CoachTurn> {
    await this.coachPolicyService.assertEnabled(userId);
    const session = await this.loadSessionOrThrow(userId, sessionId);
    await this.messageModel.create({
      sessionId: session.id,
      role: 'user',
      content: userMessage,
      toolName: null,
      toolCallId: null,
      metadata: {},
    });

    const context = await this.buildContext(userId, session);
    const history = await this.getMessages(session.id);
    const tone = await this.coachPolicyService.tone(userId);
    return { session, context, history, userMessage, tone };
  }

  /** Stores the assistant reply and updates the session. */
  async closeTurn(userId: string, turn: CoachTurn, record: CoachReplyRecord): Promise<CoachMessage> {
    const { session } = turn;
    const assistantMessage = await this.messageModel.create({
      sessionId: session.id,
      role: 'assistant',
      content: record.reply,
      toolName: null,
      toolCallId: null,
      metadata: record.metadata,
    });

    if (record.summary !== undefined) {
      session.summary = record.summary;
    }
    session.lastMessageAt = new Date();
    if (!session.title || session.title === COACH_DEFAULT_TITLE) {
      session.title = deriveCoachTitle(turn.userMessage, record.reply);
    }
    await session.save();

    this.eventEmitter.emit(
      COACH_EVENTS.REPLY_GENERATED,
      new CoachReplyGeneratedEvent(userId, session.athleteId, session.id, assistantMessage.id),
    );
    return assistantMessage;
  }

  instructions(turn: CoachTurn): string {
    return this.promptBuilder.buildInstructions(turn.tone);
  }

  /** Prompt input: context (with tool results, if any), recent history and the new message. */
  promptMessages(turn: CoachTurn, toolResults?: CoachToolExecutionResult[]): OpenAiInputMessage[] {
    const systemContent = this.promptBuilder.buildContextMessage(turn.context);
    const toolContent = toolResults?.length ? `\n\nTool Results:\n${JSON.stringify(toolResults, null, 2)}` : '';

    const messages: OpenAiInputMessage[] = [
      { role: 'system', content: [{ type: 'input_text', text: systemContent + toolContent }] },
    ];

    for (const message of turn.history.slice(-PROMPT_HISTORY_SIZE)) {
      // Tool output reaches the model through the system message, not as history.
      if (message.role === 'tool') {
        continue;
      }
      messages.push({
        role: message.role,
        content: [{ type: message.role === 'assistant' ? 'output_text' : 'input_text', text: message.content }],
      });
    }

    messages.push({ role: 'user', content: [{ type: 'input_text', text: turn.userMessage }] });
    return messages;
  }

  private async buildContext(userId: string, session: CoachSession): Promise<CoachContextInput> {
    const athlete = await this.athletesService.getAthlete(session.athleteId, userId);
    const state = await this.athletesService.getAthleteState(session.athleteId, userId);
    const goal = await this.goalsService.getLatestGoalForAthlete(session.athleteId, userId);
    // The coach works with the plan in work, not with the latest created row.
    const plan = await this.planQueryService.getActivePlanForAthlete(session.athleteId, userId);
    const recentWorkouts = await this.workoutsService.listRecentWorkoutsForAthlete(session.athleteId, userId);
    const recentPlanEdits = plan ? await this.planQueryService.listRecentUserEdits(plan.id) : [];
    const recentMessages = await this.messageModel.findAll({
      where: { sessionId: session.id },
      order: [['createdAt', 'ASC']],
      limit: PROMPT_HISTORY_SIZE,
    });

    return {
      session: toCoachSessionView(session),
      athlete,
      state,
      goal,
      plan,
      recentPlanEdits,
      recentWorkouts,
      recentMessages: recentMessages.map(toCoachMessageView),
    };
  }
}
