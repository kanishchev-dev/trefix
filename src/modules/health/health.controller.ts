import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult, HealthCheckService, SequelizeHealthIndicator } from '@nestjs/terminus';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: SequelizeHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  async check(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = await this.health.check([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (): Promise<any> => this.db.pingCheck('database'),
    ]);
    return result;
  }
}
