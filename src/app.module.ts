import KeyvRedis from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'path';

import { AvatarsModule } from '@/modules/avatars/avatars.module';

import {
  CorrelationIdMiddleware,
  REQUEST_ID_HEADER,
  resolveRequestId,
} from './common/middleware/correlation-id.middleware';
import { RedisModule } from './common/redis/redis.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import trainingConfig from './config/training.config';
import { validationSchema } from './config/validation.schema';
import { AuthModule } from './modules/auth/auth.module';
import authConfig from './modules/auth/config/auth.config';
import { CoachModule } from './modules/coach/coach.module';
import { HealthModule } from './modules/health/health.module';
import integrationsConfig from './modules/integrations/config/integrations.config';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import mailerConfig from './modules/mailer/config/mailer.config';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SettingsModule } from './modules/settings/settings.module';
import storageConfig from './modules/storage/config/storage.config';
import { StorageModule } from './modules/storage/storage.module';
import { SystemSeedModule } from './modules/system-seed/system-seed.module';
import { TrainingModule } from './modules/training/training.module';
import { AccountDeletionModule } from './modules/users/account-deletion/account-deletion.module';
import { ConsentsModule } from './modules/users/consents/consents.module';
import { PreferencesModule } from './modules/users/preferences/preferences.module';
import { UsersModule } from './modules/users/users.module';

/** Default lifetime of cache entries that do not set their own TTL. */
const CACHE_DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Credentials and personal data that must never reach the logs. */
const LOG_REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, trainingConfig, storageConfig, mailerConfig, authConfig, integrationsConfig],
      validationSchema,
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    StorageModule,
    AvatarsModule,
    PermissionsModule,
    SettingsModule,
    CoachModule,
    SystemSeedModule,
    RealtimeModule,
    TrainingModule,
    IntegrationsModule,
    PreferencesModule,
    ConsentsModule,
    AccountDeletionModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('app.logLevel'),
          // Same id as the error response `traceId` and the `X-Request-Id` header.
          genReqId: (request): string => resolveRequestId(request.headers[REQUEST_ID_HEADER]),
          redact: { paths: LOG_REDACTED_PATHS, censor: '[REDACTED]' },
          transport:
            configService.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
        },
      }),
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: (configService.get<string>('database.dialect') || 'postgres') as 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadModels: true,
        synchronize: configService.get<string>('NODE_ENV') === 'test',
      }),
    }),
    RedisModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new KeyvRedis(
            `redis://${configService.get<string>('REDIS_HOST') || 'localhost'}:${configService.get<number>('REDIS_PORT') || 6379}`,
          ),
        ],
        ttl: CACHE_DEFAULT_TTL_MS,
      }),
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('app.throttleTtl'),
          limit: configService.getOrThrow<number>('app.throttleLimit'),
        },
      ],
    }),
    I18nModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: 'en',
        loaderOptions: {
          path: path.join(__dirname, configService.getOrThrow<string>('app.i18nPath')),
          watch: configService.getOrThrow<boolean>('app.i18nWatch'),
        },
      }),
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
