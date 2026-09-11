export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
