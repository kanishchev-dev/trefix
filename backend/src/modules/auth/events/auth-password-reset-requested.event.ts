export class AuthPasswordResetRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
