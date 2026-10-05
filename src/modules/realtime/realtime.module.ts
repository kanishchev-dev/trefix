import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthRedisModule } from '@/modules/auth/auth-redis.module';
import { PermissionsModule } from '@/modules/permissions/permissions.module';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimePresenceService } from './services/realtime-presence.service';
import { SessionRevokedListener } from './listeners/session-revoked.listener';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    // Room access is resolved from live permissions instead of the JWT so
    // that revocations take effect without waiting for a token refresh.
    // forwardRef breaks the PermissionsModule <-> RealtimeModule cycle.
    forwardRef(() => PermissionsModule),
    // The gateway validates the session behind an access token exactly like the
    // REST guard does. AuthRedisModule imports nothing, so this stays a plain
    // import instead of a cycle back through the auth cluster.
    AuthRedisModule,
  ],
  providers: [RealtimeGateway, RealtimeService, RealtimePresenceService, SessionRevokedListener],
  exports: [RealtimeService, RealtimePresenceService],
})
export class RealtimeModule {}
