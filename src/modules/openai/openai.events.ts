/**
 * Names of in-process events published by the OpenAI module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const OPENAI_EVENTS = {
  USAGE_RECORDED: 'openai.usage.recorded',
} as const;

/** Product feature an OpenAI call was made for; analytics groups cost by it. */
export const LLM_FEATURES = ['coach_reply', 'workout_note', 'other'] as const;
export type LlmFeature = (typeof LLM_FEATURES)[number];

export const LLM_CALL_STATUSES = ['completed', 'failed', 'incomplete'] as const;
export type LlmCallStatus = (typeof LLM_CALL_STATUSES)[number];

/** Who and what an OpenAI call is for; attached to the request by the caller. */
export interface OpenAiUsageContext {
  feature: LlmFeature;
  userId?: string | null;
}

/** Token usage of one OpenAI call, emitted after the call finished or failed. */
export class OpenAiUsageRecordedEvent {
  constructor(
    public readonly feature: LlmFeature,
    public readonly userId: string | null,
    public readonly model: string,
    public readonly inputTokens: number,
    public readonly cachedInputTokens: number,
    public readonly outputTokens: number,
    public readonly latencyMs: number,
    public readonly status: LlmCallStatus,
  ) {}
}
