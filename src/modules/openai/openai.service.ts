import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

import { OpenAiApiException } from './exceptions/openai-api.exception';
import {
  OpenAiInputMessage,
  OpenAiResponseRequest,
  OpenAiResponseResult,
  OpenAiTextFormatJsonSchema,
} from './interfaces/openai-types.interface';

export interface OpenAiStreamDelta {
  type: string;
  delta?: string;
  isDone: boolean;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly configService: ConfigService) {}

  getConfiguredModel(): string {
    return this.configService.get<string>('openai.model') || 'gpt-5';
  }

  async createStructuredResponse<T>(request: OpenAiResponseRequest): Promise<T> {
    const response = await this.sendResponse(request);
    const outputText = this.extractText(response);

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
    const response = await this.executeRequest(request, false);
    return (await response.json()) as OpenAiResponseResult;
  }

  streamResponse(request: OpenAiResponseRequest): Observable<OpenAiStreamDelta> {
    return new Observable<OpenAiStreamDelta>((subscriber) => {
      const controller = new AbortController();
      let isAborted = false;

      const run = async () => {
        try {
          const response = await this.executeRequest(request, true, controller.signal);
          if (!response.body) {
            throw new OpenAiApiException('Response body is empty');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') {
                continue;
              }

              try {
                const json = JSON.parse(dataStr);
                const eventType = json.type;

                if (eventType === 'response.output_text.delta') {
                  subscriber.next({
                    type: 'text',
                    delta: json.delta,
                    isDone: false,
                  });
                } else if (eventType === 'response.completed') {
                  this.logger.debug(`OpenAI Stream Completed: ${json.response.id}`);
                  subscriber.next({ type: 'completed', isDone: true });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }

          subscriber.complete();
        } catch (error) {
          if (!isAborted) {
            subscriber.error(error);
          }
        }
      };

      run();

      return () => {
        isAborted = true;
        controller.abort();
      };
    });
  }

  private async executeRequest(
    request: OpenAiResponseRequest,
    stream: boolean,
    signal?: AbortSignal,
  ): Promise<Response> {
    const apiKey = this.configService.get<string>('openai.apiKey') || '';
    if (!apiKey) {
      throw new OpenAiApiException('OpenAI API key is not configured.');
    }

    const baseUrl = this.configService.get<string>('openai.baseUrl') || 'https://api.openai.com/v1';
    const model = this.configService.get<string>('openai.model') || 'gpt-5';
    const timeoutMs = stream ? 60000 : this.configService.get<number>('openai.timeoutMs') || 30000;
    const temperature = request.temperature ?? this.configService.get<number>('openai.temperature') ?? 0.2;
    const maxOutputTokens = request.maxOutputTokens ?? this.configService.get<number>('openai.maxOutputTokens') ?? 1200;
    const tracingEnabled = this.configService.get<boolean>('openai.tracingEnabled') ?? false;

    const textFormat: OpenAiTextFormatJsonSchema = {
      type: 'json_schema',
      name: request.schemaName,
      schema: request.schema,
      strict: request.strict ?? true,
    };

    const response = await fetch(this.buildResponsesUrl(baseUrl), {
      method: 'POST',
      signal,
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
        stream,
      }),
    });

    if (!response.ok) {
      const rawBody = (await response.json().catch(() => ({}))) as any;
      const errorMessage = rawBody.error?.message || `OpenAI request failed with status ${response.status}`;
      throw new OpenAiApiException(errorMessage);
    }

    return response;
  }

  async createInputMessages(messages: OpenAiInputMessage[]): Promise<OpenAiInputMessage[]> {
    return messages;
  }

  private buildResponsesUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/responses`;
  }

  private extractText(response: OpenAiResponseResult): string | undefined {
    // 1. Return top-level output_text if present (SDK convenience)
    if (response.output_text) {
      return response.output_text;
    }

    // 2. Traversal of output items for raw REST responses
    if (!response.output || !Array.isArray(response.output)) {
      return undefined;
    }

    // Usually, we want the assistant's message content
    const assistantMessage = response.output.find(
      (item) => item.type === 'message' && item.role === 'assistant',
    );

    if (!assistantMessage || !assistantMessage.content) {
      return undefined;
    }

    // Aggregate all output_text parts
    const textParts = assistantMessage.content
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text)
      .filter((text): text is string => typeof text === 'string');

    return textParts.length > 0 ? textParts.join('') : undefined;
  }
}
