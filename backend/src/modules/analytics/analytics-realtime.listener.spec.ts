import type { RealtimeService } from '@/modules/realtime/realtime.service';

import { AnalyticsRealtimeListener } from './analytics-realtime.listener';
import { AnalyticsDataChangedEvent } from './events/analytics-data-changed.event';
import type { AnalyticsChangesService } from './services/analytics-changes.service';

describe('AnalyticsRealtimeListener', () => {
  const changes = { markChanged: jest.fn() };
  const realtime = { emitToRoom: jest.fn() };
  const listener = new AnalyticsRealtimeListener(
    changes as unknown as AnalyticsChangesService,
    realtime as unknown as RealtimeService,
  );

  it('marks the data as changed on a domain event', () => {
    listener.onDataChanged();
    expect(changes.markChanged).toHaveBeenCalled();
  });

  it('pushes a change to the analytics room', () => {
    const event = new AnalyticsDataChangedEvent(3, '2026-10-17T10:00:00.000Z');
    listener.onAnalyticsChanged(event);
    expect(realtime.emitToRoom).toHaveBeenCalledWith('analytics', 'analytics.updated', event);
  });
});
