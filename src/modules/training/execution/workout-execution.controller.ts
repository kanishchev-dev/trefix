import { Controller, Get, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { DomainException } from '@/common/exceptions/domain.exception';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { TrainingService } from '../training.service';
import { WorkoutExecutionBuilder } from './workout-execution.builder';
import { WorkoutExecutionResponseDto } from './workout-execution.dto';

@ApiTags('Training')
@ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class WorkoutExecutionController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly builder: WorkoutExecutionBuilder,
  ) {}

  @Get('workouts/:id/execution')
  @RequirePermissions('training.workouts.read')
  @ApiOperation({ summary: 'Planned workout as the sequence of steps the tracker leads through' })
  @ApiOkResponse({ type: WorkoutExecutionResponseDto })
  async getExecution(
    @CurrentUser() user: AuthUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkoutExecutionResponseDto> {
    const workout = await this.trainingService.getWorkout(id, user.id);
    if (workout.status !== 'planned') {
      throw new DomainException(
        'WORKOUT_NOT_PLANNED',
        'Only a planned workout can be run from the plan',
        HttpStatus.CONFLICT,
      );
    }
    if (workout.type === 'rest') {
      throw new DomainException('WORKOUT_NOT_RUNNABLE', 'A rest day has nothing to run', HttpStatus.CONFLICT);
    }
    return this.builder.build(workout);
  }
}
