import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckService, HealthIndicatorResult, SequelizeHealthIndicator } from '@nestjs/terminus';

import { Public } from '@/common/decorators/public.decorator';

import { RedisHealthIndicator } from './redis.health';

interface HealthStatusResponse {
  status: 'ok';
}

/**
 * Both endpoints are public and answer with a bare status: which dependency
 * failed and why goes to the log, not to anonymous callers.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: SequelizeHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /** Liveness: the process runs and serves HTTP. Restarting will not fix a broken dependency. */
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok' } } })
  live(): HealthStatusResponse {
    return { status: 'ok' };
  }

  /** Readiness: the database and Redis answer, so the instance can take traffic. */
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe (database and Redis)' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok' } } })
  @ApiResponse({ status: 503, description: 'A dependency is unavailable' })
  async ready(): Promise<HealthStatusResponse> {
    try {
      await this.health.check([
        (): Promise<HealthIndicatorResult> => this.db.pingCheck('database'),
        (): Promise<HealthIndicatorResult> => this.redis.pingCheck('redis'),
      ]);
      return { status: 'ok' };
    } catch (error) {
      const details =
        error instanceof ServiceUnavailableException ? JSON.stringify(error.getResponse()) : String(error);
      this.logger.error(`Readiness check failed: ${details}`);
      throw new ServiceUnavailableException();
    }
  }
}
