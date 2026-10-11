import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

import { OpenAiInputMessage } from '@/modules/openai/interfaces/openai-types.interface';
import { OpenAiService } from '@/modules/openai/openai.service';

import { CoachDraftResponse, CoachFinalResponse, CoachToolExecutionResult } from './coach.interfaces';
import { COACH_DRAFT_SCHEMA, COACH_FINAL_SCHEMA } from './coach.schemas';
import { CoachToolRunner } from './coach.tool-runner';
import { CoachConversationService, CoachTurn } from './coach-conversation.service';
import { ReplyFieldExtractor } from './coach-reply-extractor';
import { SendCoachMessageDto } from './dto/send-coach-message.dto';

export interface CoachStreamChunk {
  delta?: string;
  isDone: boolean;
}

type Emit = (delta: string) => void;

/**
 * Streaming chat: the draft reply is streamed as it is generated; when the
 * draft asks for tools, they run and the final reply is streamed after it.
 */
@Injectable()
export class CoachStreamService {
  private readonly logger = new Logger(CoachStreamService.name);

  constructor(
    private readonly conversation: CoachConversationService,
    private readonly openAiService: OpenAiService,
    private readonly toolRunner: CoachToolRunner,
  ) {}

  async streamMessage(
    userId: string,
    sessionId: string,
    dto: SendCoachMessageDto,
  ): Promise<Observable<CoachStreamChunk>> {
    const turn = await this.conversation.openTurn(userId, sessionId, dto.message);

    return new Observable<CoachStreamChunk>((subscriber) => {
      const emit: Emit = (delta) => {
        if (delta) {
          subscriber.next({ delta, isDone: false });
        }
      };

      this.generate(userId, turn, emit)
        .then(async ({ reply, toolResults }) => {
          await this.conversation.closeTurn(userId, turn, {
            reply,
            metadata: { toolResults, isStreamed: true },
          });
          subscriber.next({ isDone: true });
          subscriber.complete();
        })
        .catch((error: unknown) => {
          this.logger.error('Streaming failed', error);
          subscriber.error(error);
        });
    });
  }

  private async generate(
    userId: string,
    turn: CoachTurn,
    emit: Emit,
  ): Promise<{ reply: string; toolResults: CoachToolExecutionResult[] }> {
    const draftStream = await this.stream(turn, this.conversation.promptMessages(turn), 'coach_draft', emit);
    const draft = draftStream.parse<CoachDraftResponse>();
    if (!draft) {
      return { reply: '', toolResults: [] };
    }

    if (draft.stage === 'need_clarification') {
      const reply = draft.clarifyingQuestion || draft.reply || '';
      emit(draftStream.remainder(reply));
      return { reply, toolResults: [] };
    }

    if (draft.toolRequests && draft.toolRequests.length > 0) {
      const toolResults = await this.toolRunner.runTools(userId, turn.session.athleteId, draft.toolRequests);
      const finalStream = await this.stream(
        turn,
        this.conversation.promptMessages(turn, toolResults),
        'coach_final',
        emit,
      );
      const reply = finalStream.parse<CoachFinalResponse>()?.reply || '';
      emit(finalStream.remainder(reply));
      return { reply, toolResults };
    }

    const reply = draft.reply || '';
    emit(draftStream.remainder(reply));
    return { reply, toolResults: [] };
  }

  /** Streams one structured response, emitting the reply text as it appears. */
  private stream(
    turn: CoachTurn,
    input: OpenAiInputMessage[],
    schemaName: 'coach_draft' | 'coach_final',
    emit: Emit,
  ): Promise<ReplyFieldExtractor> {
    const extractor = new ReplyFieldExtractor();
    return new Promise((resolve, reject) => {
      this.openAiService
        .streamResponse({
          instructions: this.conversation.instructions(),
          input,
          schemaName,
          schema: (schemaName === 'coach_draft' ? COACH_DRAFT_SCHEMA : COACH_FINAL_SCHEMA) as Record<string, unknown>,
          metadata: { module: 'coach', sessionId: turn.session.id },
        })
        .subscribe({
          next: (delta) => {
            if (delta.type === 'text' && delta.delta) {
              emit(extractor.push(delta.delta));
            }
          },
          error: (error: unknown) => reject(error),
          complete: () => {
            if (!extractor.parse()) {
              this.logger.error(`Failed to parse the streamed coach response: ${extractor.tail(100)}`);
            }
            resolve(extractor);
          },
        });
    });
  }
}
