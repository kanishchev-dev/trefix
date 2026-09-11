import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '@/app.module';
import { User } from '@/modules/users/entities/user.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  const userData = {
    id: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8',
    email: 'e2e@example.com',
    firstName: 'E2E',
    lastName: 'Test',
  };

  const mockUserInstance = {
    ...userData,
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          if (key === 'database.dialect') return 'sqlite';
          if (key === 'database.database') return ':memory:';
          if (key === 'NODE_ENV') return 'test';
          if (key === 'app.logLevel') return 'error';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return 6379;
          return null;
        }),
      })
      .overrideProvider(getModelToken(User))
      .useValue({
        create: jest.fn().mockResolvedValue(mockUserInstance),
        findOne: jest.fn().mockResolvedValue(null),
        findAll: jest.fn().mockResolvedValue([mockUserInstance]),
        findByPk: jest.fn().mockResolvedValue(mockUserInstance),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/v1/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/v1/users')
      .send({
        email: 'e2e@example.com',
        firstName: 'E2E',
        lastName: 'Test',
      })
      .expect(201)
      .expect(userData);
  });

  it('/v1/users (GET)', () => {
    return request(app.getHttpServer()).get('/v1/users').expect(200).expect([userData]);
  });

  it('/v1/users/:id (DELETE)', () => {
    return request(app.getHttpServer()).delete(`/v1/users/${userData.id}`).expect(204);
  });
});
