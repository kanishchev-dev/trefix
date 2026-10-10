import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type { Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { DomainException } from '@/common/exceptions/domain.exception';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';
import { StorageUploadedFile } from '@/modules/storage/interfaces/storage-uploaded-file.interface';

import { RECORDING_LIMITS } from '../constants/integrations.constants';
import {
  RecordedActivityAcceptedDto,
  RecordedActivityDto,
  WorkoutRecordingResponseDto,
} from './dto/recorded-activity.dto';
import { RecordingsService } from './recordings.service';

const RECORDING_RATE_LIMIT = { limit: 30, ttl: 60_000 };

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('recorded-activities')
  @RequirePermissions('training.workouts.update')
  @Throttle({ default: RECORDING_RATE_LIMIT })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'RecordedActivityDto as JSON' },
        track: { type: 'string', format: 'binary', description: 'track.json.gz' },
      },
      required: ['summary'],
    },
  })
  @UseInterceptors(FileInterceptor('track', { limits: { fileSize: RECORDING_LIMITS.maxTrackFileBytes } }))
  @ApiOperation({ summary: 'Save a run recorded in the app; repeats with the same session return the stored result' })
  @ApiOkResponse({ type: RecordedActivityAcceptedDto })
  async create(
    @CurrentUser() user: AuthUserContext,
    @Body('summary') summary: unknown,
    @UploadedFile() track: StorageUploadedFile | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecordedActivityAcceptedDto> {
    const dto = await parseSummary(summary);
    const result = await this.recordingsService.accept(user.id, dto, track);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.response;
  }

  @Get('workouts/:id/recording')
  @RequirePermissions('training.workouts.read')
  @ApiOperation({ summary: 'Route, splits and plan steps of a workout recorded in the app' })
  @ApiOkResponse({ type: WorkoutRecordingResponseDto })
  getRecording(
    @CurrentUser() user: AuthUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkoutRecordingResponseDto> {
    return this.recordingsService.getForWorkout(user.id, id);
  }
}

/** The summary travels as a JSON string next to the file, so the global pipe never sees its fields. */
async function parseSummary(summary: unknown): Promise<RecordedActivityDto> {
  let plain: unknown;
  try {
    plain = typeof summary === 'string' ? JSON.parse(summary) : summary;
  } catch {
    throw new DomainException('RECORDING_INVALID', 'summary is not valid JSON', HttpStatus.BAD_REQUEST, {
      field: 'summary',
    });
  }
  if (!plain || typeof plain !== 'object' || Array.isArray(plain)) {
    throw new DomainException('RECORDING_INVALID', 'summary is required', HttpStatus.BAD_REQUEST, { field: 'summary' });
  }
  const dto = plainToInstance(RecordedActivityDto, plain);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    const field = firstPath(errors[0]!);
    throw new DomainException('RECORDING_INVALID', `Invalid field ${field}`, HttpStatus.BAD_REQUEST, { field });
  }
  return dto;
}

function firstPath(error: ValidationError, prefix = ''): string {
  const path = prefix ? `${prefix}.${error.property}` : error.property;
  const child = error.children?.[0];
  return child ? firstPath(child, path) : path;
}
