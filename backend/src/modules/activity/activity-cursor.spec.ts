import { decodeActivityCursor, encodeActivityCursor } from './activity-cursor';

describe('activity cursor', () => {
  it('round-trips the position', () => {
    const cursor = { occurredAt: new Date('2026-10-16T09:00:00.123Z'), id: '0199b0c4-0000-7000-8000-000000000001' };

    expect(decodeActivityCursor(encodeActivityCursor(cursor))).toEqual(cursor);
  });

  it.each(['', 'garbage', Buffer.from('2026-10-16|not-a-uuid').toString('base64url')])(
    'rejects a malformed cursor %p',
    (value) => {
      expect(() => decodeActivityCursor(value)).toThrow(expect.objectContaining({ code: 'ACTIVITY_CURSOR_INVALID' }));
    },
  );
});
