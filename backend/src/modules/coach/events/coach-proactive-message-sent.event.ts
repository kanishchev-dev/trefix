/** The coach wrote to the user on its own; the message is already in the chat. */
export class CoachProactiveMessageSentEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly kind: string,
    /** Rendered in the user's language. */
    public readonly content: string,
    public readonly params: Record<string, string | number | null>,
  ) {}
}
