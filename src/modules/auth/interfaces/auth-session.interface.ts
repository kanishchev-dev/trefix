export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  /** Fields below are absent on sessions created before devices were shown to users. */
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  city?: string | null;
  country?: string | null;
  createdAt: string;
  /** Moves on every refresh, so it doubles as the last activity time. */
  updatedAt: string;
  expiresAt: string;
}
