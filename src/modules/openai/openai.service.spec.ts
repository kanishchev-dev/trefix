import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { OpenAiResponseResult } from './interfaces/openai-types.interface';
import { OpenAiService } from './openai.service';

describe('OpenAiService', () => {
  let service: OpenAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'openai.model') return 'gpt-4o-mini';
              if (key === 'openai.apiKey') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OpenAiService>(OpenAiService);
  });

  describe('extractText', () => {
    it('should return top-level output_text if present', () => {
      const response: OpenAiResponseResult = {
        id: '1',
        status: 'completed',
        output_text: 'Hello from SDK',
      };
      // Accessing private method for testing
      expect((service as unknown as { extractText(value: OpenAiResponseResult): string }).extractText(response)).toBe(
        'Hello from SDK',
      );
    });

    it('should extract text from output array in raw REST response', () => {
      const response: OpenAiResponseResult = {
        id: '1',
        status: 'completed',
        output: [
          {
            id: 'item_1',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: '{"reply": "Hello from REST"}',
              },
            ],
          },
        ],
      };
      expect((service as unknown as { extractText(value: OpenAiResponseResult): string }).extractText(response)).toBe(
        '{"reply": "Hello from REST"}',
      );
    });

    it('should return undefined if no assistant message is found', () => {
      const response: OpenAiResponseResult = {
        id: '1',
        status: 'completed',
        output: [
          {
            id: 'item_1',
            type: 'reasoning',
            content: [{ type: 'reasoning', text: 'Thinking...' }],
          },
        ],
      };
      expect(
        (service as unknown as { extractText(value: OpenAiResponseResult): string }).extractText(response),
      ).toBeUndefined();
    });

    it('should aggregate multiple output_text parts', () => {
      const response: OpenAiResponseResult = {
        id: '1',
        status: 'completed',
        output: [
          {
            id: 'item_1',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'Part 1' },
              { type: 'output_text', text: 'Part 2' },
            ],
          },
        ],
      };
      expect((service as unknown as { extractText(value: OpenAiResponseResult): string }).extractText(response)).toBe(
        'Part 1Part 2',
      );
    });
  });
});
