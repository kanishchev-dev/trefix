import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { COACH_CHAT_RESPONSE_EXAMPLE, COACH_SESSION_DETAIL_EXAMPLE, COACH_SESSION_EXAMPLE } from './coach.openapi';
import { CoachService } from './coach.service';
import { CoachStreamService, writeEventStream } from './coach-stream.service';
import { CoachChatDto } from './dto/coach-chat.dto';
import { CoachChatResponseDto, CoachSessionDetailResponseDto, CoachSessionResponseDto } from './dto/coach-response.dto';
import { CreateCoachSessionDto } from './dto/create-coach-session.dto';
import { SendCoachMessageDto } from './dto/send-coach-message.dto';

@ApiTags('Coach')
@ApiBearerAuth()
@Controller({
  path: 'coach',
  version: '1',
})
export class CoachController {
  constructor(
    private readonly coachService: CoachService,
    private readonly coachStreamService: CoachStreamService,
  ) {}

  @Post('sessions')
  @RequirePermissions('coach.sessions.create')
  @ApiOperation({ summary: 'Create a coaching session' })
  @ApiCreatedResponse({
    description: 'Coach session created',
    type: CoachSessionResponseDto,
    schema: { example: COACH_SESSION_EXAMPLE },
  })
  createSession(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateCoachSessionDto,
  ): Promise<CoachSessionResponseDto> {
    return this.coachService.createSession(user.id, dto);
  }

  @Get('sessions/latest')
  @RequirePermissions('coach.sessions.read')
  @ApiOperation({ summary: 'Get the latest coaching session' })
  @ApiOkResponse({
    description: 'Latest coach session with message history',
    type: CoachSessionDetailResponseDto,
  })
  async getLatestSession(@CurrentUser() user: AuthUserContext): Promise<CoachSessionDetailResponseDto> {
    return this.coachService.getLatestSession(user.id);
  }

  @Get('sessions/:id')
  @RequirePermissions('coach.sessions.read')
  @ApiOperation({ summary: 'Get a coaching session' })
  @ApiOkResponse({
    description: 'Coach session with message history',
    type: CoachSessionDetailResponseDto,
    schema: { example: COACH_SESSION_DETAIL_EXAMPLE },
  })
  getSession(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<CoachSessionDetailResponseDto> {
    return this.coachService.getSession(user.id, id);
  }

  /**
   * Streams the reply as server-sent events over a POST: the message travels in
   * a validated body instead of the URL, so it never lands in access logs.
   * Events: `data: {delta?, isDone}`; a failure ends the stream with
   * `event: error` and `data: {"code": "COACH_STREAM_FAILED"}`.
   */
  @Post('sessions/:id/stream')
  @RequirePermissions('coach.sessions.message')
  @ApiOperation({ summary: 'Stream a reply of the coach (server-sent events)' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Event stream of reply fragments' })
  async streamReply(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: SendCoachMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    // Errors before the first byte (no session, coach disabled) go through the exception filter as JSON.
    const stream = await this.coachStreamService.streamMessage(user.id, id, dto);
    writeEventStream(res, stream);
  }

  /** Kept while clients move to `POST sessions/:id/stream`: the message is in the URL. */
  @Sse('sessions/:id/stream')
  @Header('Deprecation', 'true')
  @RequirePermissions('coach.sessions.read')
  @ApiOperation({ summary: 'Stream a message from the coach', deprecated: true })
  async streamMessage(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Query('message') message: string,
  ): Promise<Observable<MessageEvent>> {
    const stream = await this.coachStreamService.streamMessage(user.id, id, { message });
    return stream.pipe(
      map((chunk) => ({
        data: chunk,
      })),
    );
  }

  @Post('sessions/:id/messages')
  @RequirePermissions('coach.sessions.message')
  @ApiOperation({ summary: 'Send a message to the coach' })
  @ApiCreatedResponse({
    description: 'Coach reply generated',
    type: CoachChatResponseDto,
    schema: { example: COACH_CHAT_RESPONSE_EXAMPLE },
  })
  sendMessage(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: SendCoachMessageDto,
  ): Promise<CoachChatResponseDto> {
    return this.coachService.sendMessage(user.id, id, dto);
  }

  @Post('chat')
  @RequirePermissions('coach.sessions.message')
  @ApiOperation({ summary: 'Send a chat message to the coach' })
  @ApiCreatedResponse({
    description: 'Coach reply generated',
    type: CoachChatResponseDto,
    schema: { example: COACH_CHAT_RESPONSE_EXAMPLE },
  })
  chat(@CurrentUser() user: AuthUserContext, @Body() dto: CoachChatDto): Promise<CoachChatResponseDto> {
    return this.coachService.sendMessage(user.id, dto.sessionId, { message: dto.message });
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('coach.sessions.delete')
  @ApiOperation({ summary: 'Clear the chat history; plans and workouts are not affected' })
  @ApiNoContentResponse({ description: 'All coaching sessions and messages removed' })
  clearHistory(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.coachService.clearHistory(user.id);
  }
}
