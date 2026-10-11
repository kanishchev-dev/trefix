import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { MailerModule } from '@/modules/mailer/mailer.module';
import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { UsersModule } from '@/modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRedisModule } from './auth-redis.module';
import authConfig from './config/auth.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserDeletedListener } from './listeners/user-deleted.listener';
import { AuthTokenService } from './services/auth-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    UsersModule,
    PermissionsModule,
    MailerModule,
    AuthRedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    JwtStrategy,
    JwtAuthGuard,
    UserDeletedListener,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // Global permission-based authorization for endpoints marked with @RequirePermissions
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
