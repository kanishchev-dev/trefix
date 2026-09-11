import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAiApiException } from './exceptions/openai-api.exception';
import {
  OpenAiInputMessage,
  OpenAiResponseRequest,
  OpenAiResponseResult,
  OpenAiTextFormatJsonSchema,
} from './interfaces/openai-types.interface';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly configService: ConfigService) {}

  getConfiguredModel(): string {
    return this.configService.get<string>('openai.model') || 'gpt-5';
  }

  async createStructuredResponse<T>(request: OpenAiResponseRequest): Promise<T> {
    const response = await this.sendResponse(request);
    const outputText = response.output_text;

    if (!outputText) {
      throw new OpenAiApiException('OpenAI response did not contain output text.');
    }

    try {
      return JSON.parse(outputText) as T;
    } catch (error) {
      throw new OpenAiApiException('Failed to parse structured OpenAI response.', error);
    }
  }

  async sendResponse(request: OpenAiResponseRequest): Promise<OpenAiResponseResult> {
    const apiKey = this.configService.get<string>('openai.apiKey') || '';
    if (!apiKey) {
      throw new OpenAiApiException('OpenAI API key is not configured.');
    }

    const baseUrl = this.configService.get<string>('openai.baseUrl') || 'https://api.openai.com/v1';
    const model = this.configService.get<string>('openai.model') || 'gpt-5';
    const timeoutMs = this.configService.get<number>('openai.timeoutMs') || 30000;
    const temperature = request.temperature ?? this.configService.get<number>('openai.temperature') ?? 0.2;
    const maxOutputTokens = request.maxOutputTokens ?? this.configService.get<number>('openai.maxOutputTokens') ?? 1200;
    const tracingEnabled = this.configService.get<boolean>('openai.tracingEnabled') ?? false;

    const textFormat: OpenAiTextFormatJsonSchema = {
      type: 'json_schema',
      name: request.schemaName,
      schema: request.schema,
      strict: true,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.buildResponsesUrl(baseUrl), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: request.instructions,
          input: request.input,
          text: { format: textFormat },
          temperature,
          max_output_tokens: maxOutputTokens,
          previous_response_id: request.previousResponseId ?? undefined,
          store: false,
          metadata: request.metadata,
          tracing: tracingEnabled ? 'auto' : undefined,
        }),
      });

      const rawBody = (await response.json()) as OpenAiResponseResult & { error?: { message?: string } };
      if (!response.ok) {
        const errorMessage = rawBody.error?.message || `OpenAI request failed with status ${response.status}`;
        throw new OpenAiApiException(errorMessage);
      }

      return rawBody;
    } catch (error) {
      if (error instanceof OpenAiApiException) {
        throw error;
      }

      this.logger.error('OpenAI request failed', error instanceof Error ? error.stack : String(error));
      throw new OpenAiApiException('OpenAI request failed.', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createInputMessages(messages: OpenAiInputMessage[]): Promise<OpenAiInputMessage[]> {
    return messages;
  }

  private buildResponsesUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/responses`;
  }
}
