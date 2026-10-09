import type { Queue } from 'bullmq';

import type { RealtimeService } from '@/modules/realtime/realtime.service';
import type { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import type { CoachMessage } from '../entities/coach-message.entity';
import type { CoachSession } from '../entities/coach-session.entity';
import type { ProactiveMessage } from './coach-proactive.constants';
import { CoachProactiveService } from './coach-proactive.service';

describe('CoachProactiveService', () => {
  const message: ProactiveMessage = {
    userId: 'user-1',
    athleteId: 'athlete-1',
    kind: 'gear_replace_soon',
    content: 'Пора менять кроссовки',
    params: {},
  };

  type Setup = {
    service: CoachProactiveService;
    messageModel: { create: jest.Mock };
    queue: { add: jest.Mock };
    realtime: { emitToUser: jest.Mock };
  };

  const setup = (window: { allowed: boolean; resumeAt: Date | null }): Setup => {
    const session = { id: 'session-1', lastMessageAt: null, save: jest.fn() };
    const sessionModel = { findOne: jest.fn().mockResolvedValue(session), create: jest.fn() };
    const messageModel = { create: jest.fn().mockResolvedValue({ id: 'message-1' }) };
    const queue = { add: jest.fn() };
    const policy = { proactiveMessageWindow: jest.fn().mockResolvedValue(window) };
    const realtime = { emitToUser: jest.fn() };
    const events = { emit: jest.fn() };
    const service = new CoachProactiveService(
      sessionModel as unknown as typeof CoachSession,
      messageModel as unknown as typeof CoachMessage,
      queue as unknown as Queue<ProactiveMessage>,
      policy as unknown as CoachPolicyService,
      realtime as unknown as RealtimeService,
      events as never,
    );
    return { service, messageModel, queue, realtime };
  };

  it('sends right away outside quiet hours', async () => {
    const { service, messageModel, realtime, queue } = setup({ allowed: true, resumeAt: null });
    await expect(service.deliver(message)).resolves.toBe('sent');
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', metadata: expect.objectContaining({ proactive: true }) }),
    );
    expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'coach.message.proactive', expect.any(Object));
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('postpones until quiet hours end', async () => {
    const now = new Date('2026-10-09T23:00:00Z');
    const { service, queue, messageModel } = setup({ allowed: false, resumeAt: new Date('2026-10-10T08:00:00Z') });
    await expect(service.deliver(message, now)).resolves.toBe('scheduled');
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      message,
      expect.objectContaining({ delay: 9 * 3_600_000 }),
    );
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('drops messages while the coach is off', async () => {
    const { service, queue, messageModel } = setup({ allowed: false, resumeAt: null });
    await expect(service.deliver(message)).resolves.toBe('dropped');
    expect(queue.add).not.toHaveBeenCalled();
    expect(messageModel.create).not.toHaveBeenCalled();
  });
});
