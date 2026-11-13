/** Why an administrator blocked an account; shown to administrators only. */
export const USER_BLOCK_REASONS = ['policy_violation', 'spam', 'fraud', 'user_request', 'other'] as const;
export type UserBlockReason = (typeof USER_BLOCK_REASONS)[number];

export const USER_STATUSES = ['active', 'blocked', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

interface BlockableUser {
  blockedAt: Date | null;
  blockedUntil: Date | null;
}

/** The single place that decides whether a block is in force; an expired temporary block is not. */
export function isUserBlocked(user: BlockableUser, now: Date = new Date()): boolean {
  if (!user.blockedAt) {
    return false;
  }
  return !user.blockedUntil || user.blockedUntil.getTime() > now.getTime();
}

export function resolveUserStatus(
  user: BlockableUser & { deletedAt?: Date | null },
  now: Date = new Date(),
): UserStatus {
  if (user.deletedAt) {
    return 'deleted';
  }
  return isUserBlocked(user, now) ? 'blocked' : 'active';
}
