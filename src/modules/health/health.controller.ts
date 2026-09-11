import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
  SequelizeHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('Health')
@ApiBearerAuth()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: SequelizeHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  check(): Promise<HealthCheckResult> {
    const databaseCheck = (): Promise<HealthIndicatorResult> => this.db.pingCheck('database');

    return this.health.check([databaseCheck]);
  }
}
