export class AuthEmailOtpRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly expiresInSeconds: number,
  ) {}
}
