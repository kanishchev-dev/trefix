import { EventEmitter } from 'events';
import { Response } from 'express';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';

import { OpenAiService } from '@/modules/openai/openai.service';

import { CoachToolRunner } from './coach.tool-runner';
import { CoachConversationService, CoachTurn } from './coach-conversation.service';
import { ReplyFieldExtractor } from './coach-reply-extractor';
import { CoachStreamService, writeEventStream } from './coach-stream.service';

function chunks(json: string, size = 7): Array<{ type: 'text'; delta: string }> {
  const parts: Array<{ type: 'text'; delta: string }> = [];
  for (let index = 0; index < json.length; index += size) {
    parts.push({ type: 'text', delta: json.slice(index, index + size) });
  }
  return parts;
}

describe('ReplyFieldExtractor', () => {
  it('emits the reply text incrementally and unescapes it', () => {
    const extractor = new ReplyFieldExtractor();
    const json = JSON.stringify({ stage: 'answer', reply: 'Line one\nLine "two"', summary: 's' });
    const text = chunks(json, 3)
      .map((chunk) => extractor.push(chunk.delta))
      .join('');

    expect(text).toBe('Line one\nLine "two"');
    expect(extractor.parse<{ reply: string }>()?.reply).toBe('Line one\nLine "two"');
    expect(extractor.remainder('Line one\nLine "two"')).toBe('');
  });

  it('returns null for an incomplete document', () => {
    const extractor = new ReplyFieldExtractor();
    extractor.push('{"reply":"abc');
    expect(extractor.parse()).toBeNull();
  });
});

describe('CoachStreamService', () => {
  const turn = { session: { id: 'session-1', athleteId: 'athlete-1' } } as unknown as CoachTurn;
  let conversation: jest.Mocked<
    Pick<CoachConversationService, 'openTurn' | 'closeTurn' | 'promptMessages' | 'instructions'>
  >;
  let openAi: { streamResponse: jest.Mock };
  let toolRunner: { runTools: jest.Mock };
  let service: CoachStreamService;

  beforeEach(() => {
    conversation = {
      openTurn: jest.fn().mockResolvedValue(turn),
      closeTurn: jest.fn().mockResolvedValue({ id: 'message-1' }),
      promptMessages: jest.fn().mockReturnValue([]),
      instructions: jest.fn().mockReturnValue('instructions'),
    };
    openAi = { streamResponse: jest.fn() };
    toolRunner = { runTools: jest.fn() };
    service = new CoachStreamService(
      conversation as unknown as CoachConversationService,
      openAi as unknown as OpenAiService,
      toolRunner as unknown as CoachToolRunner,
    );
  });

  it('streams a direct draft reply and stores it', async () => {
    const draft = { stage: 'answer', reply: 'Easy run today.', toolRequests: [] };
    openAi.streamResponse.mockReturnValue(of(...chunks(JSON.stringify(draft))));

    const stream = await service.streamMessage('user-1', 'session-1', { message: 'What now?' });
    const events = await firstValueFrom(stream.pipe(toArray()));

    const text = events.map((event) => event.delta ?? '').join('');
    expect(text).toBe('Easy run today.');
    expect(events.at(-1)).toEqual({ isDone: true });
    expect(conversation.closeTurn).toHaveBeenCalledWith('user-1', turn, {
      reply: 'Easy run today.',
      metadata: { toolResults: [], isStreamed: true },
    });
  });

  it('runs requested tools and streams the final reply', async () => {
    const draft = { stage: 'answer', reply: '', toolRequests: [{ name: 'get_plan', input: {} }] };
    const final = { reply: 'Your plan looks good.', summary: 's', safetyFlags: [] };
    const toolResults = [{ name: 'get_plan', input: {}, output: {} }];
    openAi.streamResponse
      .mockReturnValueOnce(of(...chunks(JSON.stringify(draft))))
      .mockReturnValueOnce(of(...chunks(JSON.stringify(final))));
    toolRunner.runTools.mockResolvedValue(toolResults);

    const stream = await service.streamMessage('user-1', 'session-1', { message: 'Check my plan' });
    const events = await firstValueFrom(stream.pipe(toArray()));

    expect(events.map((event) => event.delta ?? '').join('')).toBe('Your plan looks good.');
    expect(conversation.promptMessages).toHaveBeenLastCalledWith(turn, toolResults);
    expect(conversation.closeTurn).toHaveBeenCalledWith('user-1', turn, {
      reply: 'Your plan looks good.',
      metadata: { toolResults, isStreamed: true },
    });
  });
});

describe('writeEventStream', () => {
  function fakeResponse(): { res: Response; written: string[]; ended: () => boolean } {
    const emitter = new EventEmitter();
    const written: string[] = [];
    let ended = false;
    const res = Object.assign(emitter, {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk: string) => written.push(chunk)),
      end: jest.fn(() => {
        ended = true;
      }),
    }) as unknown as Response;
    return { res, written, ended: () => ended };
  }

  it('writes every chunk as an SSE data event and ends the response', () => {
    const { res, written, ended } = fakeResponse();
    writeEventStream(res, of({ delta: 'Hi', isDone: false }, { isDone: true }));

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(written).toEqual(['data: {"delta":"Hi","isDone":false}\n\n', 'data: {"isDone":true}\n\n']);
    expect(ended()).toBe(true);
  });

  it('ends a failed stream with an error event carrying a code only', () => {
    const { res, written, ended } = fakeResponse();
    writeEventStream(
      res,
      throwError(() => new Error('provider details')),
    );

    expect(written).toEqual(['event: error\ndata: {"code":"COACH_STREAM_FAILED"}\n\n']);
    expect(ended()).toBe(true);
  });
});
