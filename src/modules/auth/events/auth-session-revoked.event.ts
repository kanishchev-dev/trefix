export class AuthSessionRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly reason:
      'logout' | 'logout-all' | 'refresh-reuse' | 'password-reset' | 'password-change' | 'user-deleted',
  ) {}
}
