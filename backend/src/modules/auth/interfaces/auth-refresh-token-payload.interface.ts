export interface AuthRefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenType: 'refresh';
}
