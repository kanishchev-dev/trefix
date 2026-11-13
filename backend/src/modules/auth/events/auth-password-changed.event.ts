export class AuthPasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
