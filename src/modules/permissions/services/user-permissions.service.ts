import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import { ForeignKeyConstraintError } from 'sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { Permission } from '../entities/permission.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { UserPermissionGroup } from '../entities/user-permission-group.entity';
import { UserPermissionsUpdatedEvent } from '../events/user-permissions-updated.event';
import { PERMISSIONS_EVENTS } from '../permissions.events';

/** Cache namespace of effective permissions; see `getEffectivePermissions`. */
const EFFECTIVE_PERMISSIONS_KEY_PREFIX = 'permissions:effective:';
/** Bumped on any catalog change, which invalidates every user's cached entry at once. */
const CATALOG_VERSION_KEY = 'permissions:catalog-version';
/** Upper bound of staleness should an invalidation ever be missed. */
const EFFECTIVE_PERMISSIONS_TTL_MS = 60_000;
/** The version key must outlive every entry built on it. */
const CATALOG_VERSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface UserAccessGroup {
  id: string;
  name: string;
  description?: string;
  systemKey: string | null;
  isSystem: boolean;
}

export interface UserAccessSummary {
  groups: UserAccessGroup[];
  individualPermissions: Array<{ name: string; description?: string }>;
  effectivePermissions: string[];
}

/**
 * What a user may do: group memberships, individual grants and the effective
 * permission set the guards check.
 */
@Injectable()
export class UserPermissionsService {
  constructor(
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(PermissionGroup)
    private readonly permissionGroupModel: typeof PermissionGroup,
    @InjectModel(UserPermission)
    private readonly userPermissionModel: typeof UserPermission,
    @InjectModel(UserPermissionGroup)
    private readonly userPermissionGroupModel: typeof UserPermissionGroup,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Union of individual grants and permissions of every group of the user.
   *
   * Cached in Redis because guards resolve it on every request. Caching an
   * authorization input is deliberate here (guidelines, section 13): every
   * change of grants or of the catalog invalidates the shared entry
   * immediately for all instances, and the short TTL bounds staleness if an
   * invalidation is ever lost.
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const key = await this.effectivePermissionsKey(userId);
    const cached = await this.cache.get<string[]>(key);
    if (cached) {
      return cached;
    }
    const permissions = (await this.loadAccess(userId)).effectivePermissions;
    await this.cache.set(key, permissions, EFFECTIVE_PERMISSIONS_TTL_MS);
    return permissions;
  }

  /** Groups, individual grants and the effective set; for admin screens, never cached. */
  async getAccessSummary(userId: string): Promise<UserAccessSummary> {
    return this.loadAccess(userId);
  }

  async assignGroupToUser(userId: string, groupId: string): Promise<void> {
    await this.findGroup(groupId);
    await this.insertIgnoringDuplicate(userId, () =>
      this.userPermissionGroupModel.findOrCreate({ where: { userId, permissionGroupId: groupId } }),
    );
    await this.changed(userId, 'assign_group', groupId);
  }

  async revokeGroupFromUser(userId: string, groupId: string): Promise<void> {
    await this.findGroup(groupId);
    await this.userPermissionGroupModel.destroy({ where: { userId, permissionGroupId: groupId } });
    await this.changed(userId, 'revoke_group', groupId);
  }

  async assignPermissionToUser(userId: string, permissionId: string): Promise<void> {
    await this.findPermission(permissionId);
    await this.insertIgnoringDuplicate(userId, () =>
      this.userPermissionModel.findOrCreate({ where: { userId, permissionId } }),
    );
    await this.changed(userId, 'assign_permission', permissionId);
  }

  async revokePermissionFromUser(userId: string, permissionId: string): Promise<void> {
    await this.findPermission(permissionId);
    await this.userPermissionModel.destroy({ where: { userId, permissionId } });
    await this.changed(userId, 'revoke_permission', permissionId);
  }

  /** Initial access of a new account; ids that no longer exist are skipped. */
  async grantInitialAccess(userId: string, groupIds: string[], permissionIds: string[]): Promise<void> {
    const groups = groupIds.length ? await this.permissionGroupModel.findAll({ where: { id: groupIds } }) : [];
    const permissions = permissionIds.length
      ? await this.permissionModel.findAll({ where: { id: permissionIds } })
      : [];
    for (const group of groups) {
      await this.userPermissionGroupModel.findOrCreate({ where: { userId, permissionGroupId: group.id } });
    }
    for (const permission of permissions) {
      await this.userPermissionModel.findOrCreate({ where: { userId, permissionId: permission.id } });
    }
    await this.invalidateUser(userId);
  }

  /** Drops one user's cached permissions. */
  async invalidateUser(userId: string): Promise<void> {
    await this.cache.del(await this.effectivePermissionsKey(userId));
  }

  /** Invalidates every user's cached permissions after a catalog or group change. */
  async invalidateAll(): Promise<void> {
    await this.cache.set(CATALOG_VERSION_KEY, Date.now(), CATALOG_VERSION_TTL_MS);
  }

  private async loadAccess(userId: string): Promise<UserAccessSummary> {
    const [individualLinks, groupLinks] = await Promise.all([
      this.userPermissionModel.findAll({ where: { userId }, attributes: ['permissionId'] }),
      this.userPermissionGroupModel.findAll({ where: { userId }, attributes: ['permissionGroupId'] }),
    ]);
    // Soft-deleted groups and permissions drop out here: both models are paranoid.
    const [individual, groups] = await Promise.all([
      individualLinks.length
        ? this.permissionModel.findAll({ where: { id: individualLinks.map((link) => link.permissionId) } })
        : Promise.resolve([] as Permission[]),
      groupLinks.length
        ? this.permissionGroupModel.findAll({
            where: { id: groupLinks.map((link) => link.permissionGroupId) },
            include: [{ model: Permission, as: 'permissions', attributes: ['name'], through: { attributes: [] } }],
          })
        : Promise.resolve([] as PermissionGroup[]),
    ]);

    const effective = new Set(individual.map((permission) => permission.name));
    for (const group of groups) {
      for (const permission of group.permissions ?? []) {
        effective.add(permission.name);
      }
    }

    return {
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        systemKey: group.systemKey,
        isSystem: group.isSystem,
      })),
      individualPermissions: individual.map((permission) => ({
        name: permission.name,
        description: permission.description,
      })),
      effectivePermissions: [...effective],
    };
  }

  private async effectivePermissionsKey(userId: string): Promise<string> {
    const version = (await this.cache.get<number>(CATALOG_VERSION_KEY)) ?? 0;
    return `${EFFECTIVE_PERMISSIONS_KEY_PREFIX}${version}:${userId}`;
  }

  private async changed(
    userId: string,
    action: UserPermissionsUpdatedEvent['action'],
    targetId: string,
  ): Promise<void> {
    await this.invalidateUser(userId);
    this.eventEmitter.emit(
      PERMISSIONS_EVENTS.USER_PERMISSIONS_UPDATED,
      new UserPermissionsUpdatedEvent(userId, action, targetId),
    );
  }

  /** A missing user surfaces as a foreign key violation of the link row. */
  private async insertIgnoringDuplicate(userId: string, insert: () => Promise<unknown>): Promise<void> {
    try {
      await insert();
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw new EntityNotFoundException('User', userId);
      }
      throw error;
    }
  }

  private async findGroup(id: string): Promise<PermissionGroup> {
    const group = await this.permissionGroupModel.findByPk(id);
    if (!group) {
      throw new EntityNotFoundException('PermissionGroup', id);
    }
    return group;
  }

  private async findPermission(id: string): Promise<Permission> {
    const permission = await this.permissionModel.findByPk(id);
    if (!permission) {
      throw new EntityNotFoundException('Permission', id);
    }
    return permission;
  }
}
