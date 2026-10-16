export class AuthSessionRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly reason:
      | 'logout'
      | 'logout-all'
      | 'logout-others'
      | 'revoked'
      | 'refresh-reuse'
      | 'password-reset'
      | 'password-change'
      | 'email-change'
      | 'user-deleted',
  ) {}
}
