export class AuthEmailChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly previousEmail: string,
    public readonly email: string,
  ) {}
}
