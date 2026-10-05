import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Readable } from 'stream';

import { AvatarService } from './avatar.service';
import { AvatarsController } from './avatars.controller';

// `esModuleInterop` is off in this project, so supertest's callable export
// has to be pulled in through `require`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request: typeof import('supertest') = require('supertest');

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('AvatarsController', () => {
  let app: INestApplication;

  const avatarService = {
    uploadAvatar: jest.fn(),
    resolveAvatarSource: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AvatarsController],
      providers: [{ provide: AvatarService, useValue: avatarService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Avatars are served without a session on purpose: activation emails and the
   * mobile app on a cold start have to be able to render them.
   */
  it('serves a managed avatar with immutable cache headers', async () => {
    avatarService.resolveAvatarSource.mockResolvedValue({
      kind: 'file',
      stream: Readable.from([Buffer.from('image-bytes')]),
      mimeType: 'image/webp',
      size: 11,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/avatars/${USER_ID}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('image/webp');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(response.body).toString()).toBe('image-bytes');
  });

  /**
   * The admin panel and the mobile app embed the avatar with a plain `<img>`
   * from another origin. Without this header `helmet`'s default
   * `Cross-Origin-Resource-Policy: same-origin` makes the browser drop the
   * image, and the UI keeps showing the fallback instead of the new avatar.
   */
  it('allows the avatar to be embedded cross-origin', async () => {
    avatarService.resolveAvatarSource.mockResolvedValue({
      kind: 'file',
      stream: Readable.from([Buffer.from('image-bytes')]),
      mimeType: 'image/webp',
      size: 11,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/avatars/${USER_ID}`)
      .expect(200);

    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('redirects an externally hosted avatar', async () => {
    avatarService.resolveAvatarSource.mockResolvedValue({
      kind: 'redirect',
      url: 'https://cdn.example.com/me.png',
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/avatars/${USER_ID}`)
      .expect(302);

    expect(response.headers.location).toBe('https://cdn.example.com/me.png');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('rejects a non-uuid user id', async () => {
    await request(app.getHttpServer()).get('/v1/avatars/not-a-uuid').expect(400);

    expect(avatarService.resolveAvatarSource).not.toHaveBeenCalled();
  });

  /**
   * Administrators set other people's photos from the user edit form, which is
   * why the upload target is addressable and not hard-wired to the session.
   */
  it('uploads the avatar of another user', async () => {
    const avatarUrl = `https://api.example.com/v1/avatars/${USER_ID}?v=file-new`;
    avatarService.uploadAvatar.mockResolvedValue(avatarUrl);

    const response = await request(app.getHttpServer())
      .post(`/v1/avatars/${USER_ID}`)
      .attach('file', Buffer.from('image-bytes'), {
        filename: 'avatar.webp',
        contentType: 'image/webp',
      })
      .expect(201);

    expect(response.body).toEqual({ avatarUrl });
    expect(avatarService.uploadAvatar).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ mimetype: 'image/webp' }),
    );
  });

  it('rejects a non-uuid user id on upload', async () => {
    await request(app.getHttpServer())
      .post('/v1/avatars/not-a-uuid')
      .attach('file', Buffer.from('image-bytes'), {
        filename: 'avatar.webp',
        contentType: 'image/webp',
      })
      .expect(400);

    expect(avatarService.uploadAvatar).not.toHaveBeenCalled();
  });
});
