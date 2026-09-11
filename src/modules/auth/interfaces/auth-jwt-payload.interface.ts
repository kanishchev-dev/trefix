export interface AuthJwtPayload {
  sub: string;
  sessionId: string;
  tokenType: 'access' | 'refresh';
}
