import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { I18nService } from 'nestjs-i18n';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ValidationException } from './common/exceptions/validation.exception';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

const SWAGGER_PATH = 'docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors): ValidationException => ValidationException.fromValidationErrors(errors),
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter(app.get(I18nService)));

  const configService = app.get(ConfigService);

  // The schema describes every endpoint, including admin ones, so it is off in production.
  const swaggerEnabled = configService.getOrThrow<boolean>('app.swaggerEnabled');
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Trefix API')
      .setDescription('The Trefix project API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config));
  }

  // Closes the Sequelize pool and lets BullMQ workers finish their current jobs on SIGTERM.
  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('app.port');
  const corsOrigins = configService.getOrThrow<string[]>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger documentation is available at: http://localhost:${port}/${SWAGGER_PATH}`);
  }
}

void bootstrap();
