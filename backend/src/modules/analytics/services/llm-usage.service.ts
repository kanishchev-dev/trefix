import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import type { OpenAiUsageRecordedEvent } from '@/modules/openai/openai.events';

import { LlmUsage } from '../entities/llm-usage.entity';
import { costUsd, DEFAULT_LLM_PRICING, type LlmPricing, priceFor } from '../lib/llm-pricing';

export type LlmUsageJobData = Pick<
  OpenAiUsageRecordedEvent,
  'feature' | 'userId' | 'model' | 'inputTokens' | 'cachedInputTokens' | 'outputTokens' | 'latencyMs' | 'status'
> & { createdAt: string };

/** Stores token usage of LLM calls with their cost at today's prices. */
@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);
  private readonly reportedModels = new Set<string>();

  constructor(
    @InjectModel(LlmUsage) private readonly usageModel: typeof LlmUsage,
    private readonly configService: ConfigService,
  ) {}

  async record(job: LlmUsageJobData): Promise<void> {
    const pricing = this.configService.get<LlmPricing>('analytics.llmPricing') ?? DEFAULT_LLM_PRICING;
    const price = priceFor(pricing, job.model);
    if (!price && !this.reportedModels.has(job.model)) {
      this.reportedModels.add(job.model);
      this.logger.warn(`No LLM price for model "${job.model}"; its calls are stored with zero cost (set LLM_PRICING)`);
    }
    const cost = price
      ? costUsd(price, { input: job.inputTokens, cachedInput: job.cachedInputTokens, output: job.outputTokens })
      : 0;
    await this.usageModel.create({
      userId: job.userId,
      feature: job.feature,
      model: job.model.slice(0, 64),
      inputTokens: job.inputTokens,
      cachedInputTokens: job.cachedInputTokens,
      outputTokens: job.outputTokens,
      costUsd: cost.toFixed(6),
      latencyMs: job.latencyMs,
      status: job.status,
      createdAt: new Date(job.createdAt),
    });
  }
}
