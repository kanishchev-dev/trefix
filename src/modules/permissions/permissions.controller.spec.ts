import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';

import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

// `esModuleInterop` is off in this project, so supertest's callable export
// has to be pulled in through `require`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request: typeof import('supertest') = require('supertest');

/**
 * Route resolution is order-sensitive in Express: `GET /permissions/groups`
 * has to be declared before `GET /permissions/:id`, otherwise the literal
 * segment is swallowed by the `:id` route and `ParseUUIDPipe` rejects it.
 * These tests boot a real HTTP app so that regression is caught.
 */
describe('PermissionsController routing', () => {
  let app: INestApplication;

  const emptyPage = {
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  const permissionsService = {
    findAllPermissions: jest.fn().mockResolvedValue(emptyPage),
    findPermissionCatalog: jest.fn().mockResolvedValue([]),
    findAllGroups: jest.fn().mockResolvedValue(emptyPage),
    findPermission: jest.fn().mockResolvedValue({ id: 'perm-id' }),
    findGroup: jest.fn().mockResolvedValue({ id: 'group-id' }),
    addPermissionToGroup: jest.fn(),
    removePermissionFromGroup: jest.fn(),
    assignGroupToUser: jest.fn(),
    revokeGroupFromUser: jest.fn(),
    assignPermissionToUser: jest.fn(),
    revokePermissionFromUser: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        { provide: PermissionsService, useValue: permissionsService },
        { provide: UserPermissionsService, useValue: permissionsService },
      ],
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

  it('routes GET /permissions to the permission list', async () => {
    await request(app.getHttpServer()).get('/v1/permissions').expect(200);

    expect(permissionsService.findAllPermissions).toHaveBeenCalled();
  });

  it('routes GET /permissions/catalog to the unpaginated catalog', async () => {
    await request(app.getHttpServer()).get('/v1/permissions/catalog').expect(200);

    expect(permissionsService.findPermissionCatalog).toHaveBeenCalled();
    expect(permissionsService.findPermission).not.toHaveBeenCalled();
  });

  it('routes GET /permissions/groups to the group list, not to :id', async () => {
    await request(app.getHttpServer()).get('/v1/permissions/groups').expect(200);

    expect(permissionsService.findAllGroups).toHaveBeenCalled();
    expect(permissionsService.findPermission).not.toHaveBeenCalled();
  });

  it('routes GET /permissions/groups/:id to the group detail', async () => {
    await request(app.getHttpServer()).get('/v1/permissions/groups/6c9b1f7e-0f5e-4f2e-9a2b-8f4a5d6c7e8f').expect(200);

    expect(permissionsService.findGroup).toHaveBeenCalled();
  });

  it('rejects a non-uuid segment on GET /permissions/:id', async () => {
    await request(app.getHttpServer()).get('/v1/permissions/not-a-uuid').expect(400);

    expect(permissionsService.findPermission).not.toHaveBeenCalled();
  });

  /**
   * Assignment endpoints return no body. Without an explicit 204 they answered
   * 200/201 with an empty payload, and the web client crashed while parsing it
   * as JSON right after a request that had actually succeeded.
   */
  describe('assignment endpoints answer 204', () => {
    const groupId = '6c9b1f7e-0f5e-4f2e-9a2b-8f4a5d6c7e8f';
    const permissionId = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
    const userId = '2c3d4e5f-6a70-4b8c-9d0e-1f2a3b4c5d6e';

    beforeEach(() => {
      permissionsService.addPermissionToGroup = jest.fn().mockResolvedValue(undefined);
      permissionsService.removePermissionFromGroup = jest.fn().mockResolvedValue(undefined);
      permissionsService.assignGroupToUser = jest.fn().mockResolvedValue(undefined);
      permissionsService.revokeGroupFromUser = jest.fn().mockResolvedValue(undefined);
      permissionsService.assignPermissionToUser = jest.fn().mockResolvedValue(undefined);
      permissionsService.revokePermissionFromUser = jest.fn().mockResolvedValue(undefined);
    });

    it.each([
      ['post', `/v1/permissions/groups/${groupId}/permissions/${permissionId}`],
      ['delete', `/v1/permissions/groups/${groupId}/permissions/${permissionId}`],
      ['post', `/v1/permissions/users/${userId}/groups/${groupId}`],
      ['delete', `/v1/permissions/users/${userId}/groups/${groupId}`],
      ['post', `/v1/permissions/users/${userId}/permissions/${permissionId}`],
      ['delete', `/v1/permissions/users/${userId}/permissions/${permissionId}`],
    ] as const)('%s %s', async (method, path) => {
      const response = await request(app.getHttpServer())[method](path).expect(204);

      expect(response.text).toBe('');
    });
  });
});
