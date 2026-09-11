import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { COACH_CHAT_RESPONSE_EXAMPLE, COACH_SESSION_DETAIL_EXAMPLE, COACH_SESSION_EXAMPLE } from './coach.openapi';
import { CoachService } from './coach.service';
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
  constructor(private readonly coachService: CoachService) {}

  @Post('sessions')
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

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a coaching session' })
  @ApiOkResponse({
    description: 'Coach session with message history',
    type: CoachSessionDetailResponseDto,
    schema: { example: COACH_SESSION_DETAIL_EXAMPLE },
  })
  getSession(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<CoachSessionDetailResponseDto> {
    return this.coachService.getSession(user.id, id);
  }

  @Post('sessions/:id/messages')
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
  @ApiOperation({ summary: 'Send a chat message to the coach' })
  @ApiCreatedResponse({
    description: 'Coach reply generated',
    type: CoachChatResponseDto,
    schema: { example: COACH_CHAT_RESPONSE_EXAMPLE },
  })
  chat(@CurrentUser() user: AuthUserContext, @Body() dto: CoachChatDto): Promise<CoachChatResponseDto> {
    return this.coachService.sendMessage(user.id, dto.sessionId, { message: dto.message });
  }
}
