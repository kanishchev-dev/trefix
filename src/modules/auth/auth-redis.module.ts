import { Module } from '@nestjs/common';

import { AuthRedisService } from './services/auth-redis.service';

/**
 * Exposes the Redis-backed session store on its own.
 *
 * Both the auth flow and the realtime gateway need it, and the gateway already
 * sits underneath the auth cluster — every feature module depends on realtime.
 * Publishing the store from a module with no imports of its own keeps that
 * relationship a straight line instead of a cycle through half the codebase.
 */
@Module({
  providers: [AuthRedisService],
  exports: [AuthRedisService],
})
export class AuthRedisModule {}
