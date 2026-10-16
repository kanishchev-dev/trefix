import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import type { AuthSessionRevokedEvent } from '@/modules/auth/events/auth-session-revoked.event';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import type { CoachProactiveMessageSentEvent } from '@/modules/coach/events/coach-proactive-message-sent.event';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';

import type { NotificationCreatedEvent, NotificationsReadEvent } from '../events/notification.events';
import { NotificationDeletedEvent } from '../events/notification.events';
import { NotificationSenderService } from '../notification-sender.service';
import { NOTIFICATIONS_FALLBACK_LANGUAGE, NOTIFICATIONS_REALTIME_EVENTS } from '../notifications.constants';
import { NOTIFICATIONS_EVENTS } from '../notifications.events';
import { NotificationsService } from '../notifications.service';
import { PushDevicesService } from '../push/push-devices.service';

/** Reacts to other modules and keeps clients' unread badges in sync. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly sender: NotificationSenderService,
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: PushDevicesService,
    private readonly preferencesService: UserPreferencesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** The coach message stays in the chat; the inbox gets a pointer to it and the phone a push. */
  @OnEvent(COACH_EVENTS.PROACTIVE_MESSAGE_SENT, { async: true })
  async handleCoachMessage(event: CoachProactiveMessageSentEvent): Promise<void> {
    try {
      const language =
        (await this.preferencesService.getEntity(event.userId)).language ?? NOTIFICATIONS_FALLBACK_LANGUAGE;
      await this.sender.notify({
        userId: event.userId,
        type: 'coach.message',
        content: { [language]: { title: null, body: event.content } },
        params: { kind: event.kind, ...event.params },
        link: { target: 'coach', id: event.sessionId },
      });
    } catch (error) {
      this.logger.warn(`Cannot notify about coach message ${event.messageId}: ${(error as Error).message}`);
    }
  }

  /** A signed-out phone must stop receiving the account's pushes. */
  @OnEvent(AUTH_EVENTS.SESSION_REVOKED, { async: true })
  async handleSessionRevoked(event: AuthSessionRevokedEvent): Promise<void> {
    try {
      await this.devicesService.removeBySession(event.sessionId);
    } catch (error) {
      this.logger.warn(`Cannot remove push devices of session ${event.sessionId}: ${(error as Error).message}`);
    }
  }

  @OnEvent(NOTIFICATIONS_EVENTS.CREATED, { async: true })
  async handleCreated(event: NotificationCreatedEvent): Promise<void> {
    await this.emitCount(event.userId, NOTIFICATIONS_REALTIME_EVENTS.CREATED, { id: event.notificationId });
  }

  @OnEvent(NOTIFICATIONS_EVENTS.READ, { async: true })
  async handleRead(event: NotificationsReadEvent): Promise<void> {
    await this.emitCount(event.userId, NOTIFICATIONS_REALTIME_EVENTS.UPDATED);
  }

  @OnEvent(NOTIFICATIONS_EVENTS.DELETED, { async: true })
  async handleDeleted(event: NotificationDeletedEvent): Promise<void> {
    await this.emitCount(event.userId, NOTIFICATIONS_REALTIME_EVENTS.UPDATED);
  }

  private async emitCount(userId: string, name: string, extra: Record<string, string> = {}): Promise<void> {
    try {
      const unreadCount = await this.notificationsService.unreadCount(userId);
      this.realtimeService.emitToUser(userId, name, { ...extra, unreadCount });
    } catch (error) {
      this.logger.warn(`Cannot sync notification badge of user ${userId}: ${(error as Error).message}`);
    }
  }
}
