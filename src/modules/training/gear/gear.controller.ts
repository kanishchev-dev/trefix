import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import {
  AssignWorkoutGearDto,
  CreateGearDto,
  GearListQueryDto,
  GearListResponseDto,
  GearResponseDto,
  UpdateGearDto,
} from './dto/gear.dto';
import { GearService } from './gear.service';

const GEAR_EXAMPLE = {
  id: '01929b5e-6f1d-7c3a-9a55-3b4f1e2d9c10',
  type: 'shoes',
  brand: 'Nike',
  model: 'Pegasus 41',
  nickname: null,
  initialDistanceKm: 0,
  limitKm: 700,
  startedAt: '2026-08-01',
  retiredAt: null,
  status: 'active',
  defaultWorkoutTypes: ['easy', 'recovery'],
  replaceReminder: true,
  source: 'manual',
  distanceKm: 412.5,
  workoutsCount: 38,
  remainingKm: 287.5,
  wearPercent: 59,
  replaceSoon: false,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-10-05T07:12:00.000Z',
};

@ApiTags('Gear')
@ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class GearController {
  constructor(private readonly gearService: GearService) {}

  @Get('gear')
  @RequirePermissions('training.gear.read')
  @ApiOperation({ summary: 'List own gear with mileage' })
  @ApiOkResponse({ type: GearListResponseDto, schema: { example: { items: [GEAR_EXAMPLE] } } })
  list(@CurrentUser() user: AuthUserContext, @Query() query: GearListQueryDto): Promise<GearListResponseDto> {
    return this.gearService.list(user.id, query.status);
  }

  @Get('gear/:id')
  @RequirePermissions('training.gear.read')
  @ApiOperation({ summary: 'Get a pair of shoes' })
  @ApiOkResponse({ type: GearResponseDto, schema: { example: GEAR_EXAMPLE } })
  get(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<GearResponseDto> {
    return this.gearService.get(user.id, id);
  }

  @Post('gear')
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Add gear; its default workout types are taken off other active pairs' })
  @ApiCreatedResponse({ type: GearResponseDto, schema: { example: GEAR_EXAMPLE } })
  create(@CurrentUser() user: AuthUserContext, @Body() dto: CreateGearDto): Promise<GearResponseDto> {
    return this.gearService.create(user.id, dto);
  }

  @Patch('gear/:id')
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Edit gear', description: 'Errors: GEAR_NOT_FOUND, GEAR_RETIRED' })
  @ApiOkResponse({ type: GearResponseDto, schema: { example: GEAR_EXAMPLE } })
  update(
    @CurrentUser() user: AuthUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGearDto,
  ): Promise<GearResponseDto> {
    return this.gearService.update(user.id, id, dto);
  }

  @Post('gear/:id/retire')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Move gear to the archive' })
  @ApiOkResponse({ type: GearResponseDto })
  retire(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<GearResponseDto> {
    return this.gearService.retire(user.id, id);
  }

  @Post('gear/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Return gear from the archive' })
  @ApiOkResponse({ type: GearResponseDto })
  restore(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<GearResponseDto> {
    return this.gearService.restore(user.id, id);
  }

  @Delete('gear/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Delete gear; its workouts keep their history without the link' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.gearService.remove(user.id, id);
  }

  @Patch('workouts/:id/gear')
  @RequirePermissions('training.gear.manage')
  @ApiOperation({ summary: 'Set or clear the shoes of a workout' })
  @ApiOkResponse({ schema: { example: { workoutId: '01929b5e-…', gearId: GEAR_EXAMPLE.id } } })
  assign(
    @CurrentUser() user: AuthUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkoutGearDto,
  ): Promise<{ workoutId: string; gearId: string | null }> {
    return this.gearService.assignToWorkout(user.id, id, dto.gearId ?? null);
  }
}
