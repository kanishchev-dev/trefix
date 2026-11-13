import { isUserBlocked, resolveUserStatus } from './user-status';

const NOW = new Date('2026-10-16T10:00:00.000Z');

describe('user status', () => {
  it('is blocked until unblocked when no end is set', () => {
    expect(isUserBlocked({ blockedAt: new Date('2026-10-01'), blockedUntil: null }, NOW)).toBe(true);
  });

  it('is blocked before the end of a temporary block and active after it', () => {
    const user = { blockedAt: new Date('2026-10-01'), blockedUntil: new Date('2026-10-20') };

    expect(isUserBlocked(user, NOW)).toBe(true);
    expect(isUserBlocked(user, new Date('2026-10-21'))).toBe(false);
  });

  it('puts deletion above blocking', () => {
    expect(resolveUserStatus({ blockedAt: null, blockedUntil: null }, NOW)).toBe('active');
    expect(resolveUserStatus({ blockedAt: NOW, blockedUntil: null }, NOW)).toBe('blocked');
    expect(resolveUserStatus({ blockedAt: NOW, blockedUntil: null, deletedAt: NOW }, NOW)).toBe('deleted');
  });
});
