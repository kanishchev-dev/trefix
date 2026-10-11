import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';

import { COACH_EVENTS } from '@/modules/coach/coach.events';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { COACH_DEFAULT_TITLE } from '../coach.constants';
import { CoachMessage } from '../entities/coach-message.entity';
import { CoachSession } from '../entities/coach-session.entity';
import { CoachReplyGeneratedEvent } from '../events/coach-reply-generated.event';
import { COACH_PROACTIVE_JOB, COACH_PROACTIVE_QUEUE, type ProactiveMessage } from './coach-proactive.constants';

/**
 * Messages the coach starts on its own (gear wear, plan change proposals).
 * They respect the coach settings: nothing is sent while the coach is off,
 * and during quiet hours delivery is postponed until they end.
 */
@Injectable()
export class CoachProactiveService {
  private readonly logger = new Logger(CoachProactiveService.name);

  constructor(
    @InjectModel(CoachSession)
    private readonly sessionModel: typeof CoachSession,
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
    @InjectQueue(COACH_PROACTIVE_QUEUE)
    private readonly queue: Queue<ProactiveMessage>,
    private readonly coachPolicyService: CoachPolicyService,
    private readonly realtimeService: RealtimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Sends now, schedules for the end of quiet hours, or drops when the coach is off. */
  async deliver(message: ProactiveMessage, now = new Date()): Promise<'sent' | 'scheduled' | 'dropped'> {
    const window = await this.coachPolicyService.proactiveMessageWindow(message.userId, now);
    if (window.allowed) {
      await this.send(message);
      return 'sent';
    }
    if (!window.resumeAt) {
      return 'dropped';
    }
    await this.queue.add(COACH_PROACTIVE_JOB, message, {
      delay: Math.max(0, window.resumeAt.getTime() - now.getTime()),
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
    });
    return 'scheduled';
  }

  /** Writes the message into the latest chat session (creating one if needed) and notifies the user. */
  async send(message: ProactiveMessage): Promise<void> {
    let session = await this.sessionModel.findOne({
      where: { userId: message.userId },
      order: [
        ['lastMessageAt', 'DESC NULLS LAST'],
        ['createdAt', 'DESC'],
      ],
    });
    if (!session) {
      session = await this.sessionModel.create({
        userId: message.userId,
        athleteId: message.athleteId,
        title: COACH_DEFAULT_TITLE,
        summary: null,
        model: 'proactive',
        lastMessageAt: null,
      });
    }
    const created = await this.messageModel.create({
      sessionId: session.id,
      role: 'assistant',
      content: message.content,
      toolName: null,
      toolCallId: null,
      metadata: { proactive: true, kind: message.kind, params: message.params },
    });
    session.lastMessageAt = new Date();
    await session.save();

    this.eventEmitter.emit(
      COACH_EVENTS.REPLY_GENERATED,
      new CoachReplyGeneratedEvent(message.userId, message.athleteId, session.id, created.id),
    );
    this.realtimeService.emitToUser(message.userId, 'coach.message.proactive', {
      sessionId: session.id,
      messageId: created.id,
      kind: message.kind,
    });
    this.logger.log(`Proactive coach message ${message.kind} sent to user ${message.userId}`);
  }
}
