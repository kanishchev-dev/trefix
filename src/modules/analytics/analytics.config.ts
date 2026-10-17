import { registerAs } from '@nestjs/config';

import { ANALYTICS_DEFAULT_TIMEZONE } from './analytics.constants';
import { parseLlmPricing } from './lib/llm-pricing';

export default registerAs('analytics', () => ({
  /** Day boundaries when a request names no timezone, and of the nightly snapshot. */
  defaultTimezone: process.env.ANALYTICS_DEFAULT_TIMEZONE || ANALYTICS_DEFAULT_TIMEZONE,
  /** Prices per 1M tokens by model; env overrides the built-in table. */
  llmPricing: parseLlmPricing(process.env.LLM_PRICING),
}));
