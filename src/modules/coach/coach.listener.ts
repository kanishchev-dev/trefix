import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { CoachReplyGeneratedEvent } from './events/coach-reply-generated.event';
import { CoachSessionCreatedEvent } from './events/coach-session-created.event';

@Injectable()
export class CoachListener {
  private readonly logger = new Logger(CoachListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent('coach.session.created')
  handleSessionCreated(event: CoachSessionCreatedEvent): void {
    this.logger.log(`coach.session.created for session ${event.sessionId}`);
    this.realtimeService.emitToRoom('coach', 'coach.session.created', event);
  }

  @OnEvent('coach.reply.generated')
  handleReplyGenerated(event: CoachReplyGeneratedEvent): void {
    this.logger.log(`coach.reply.generated for message ${event.messageId}`);
    this.realtimeService.emitToRoom('coach', 'coach.reply.generated', event);
  }
}
