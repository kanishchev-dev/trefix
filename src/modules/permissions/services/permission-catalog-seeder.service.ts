import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';

import { InvariantViolationException } from '@/common/exceptions/invariant-violation.exception';

import { SYSTEM_PERMISSION_CATALOG, SYSTEM_PERMISSION_GROUPS } from '../constants/system-access.constants';
import { Permission } from '../entities/permission.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { UserPermissionGroup } from '../entities/user-permission-group.entity';

export type SystemGroups = Record<'administrators' | 'registeredUsers', PermissionGroup>;

/**
 * Seeds the system permission catalog and system groups.
 *
 * Everything here is additive and restore-only: admins edit names,
 * descriptions and group contents from the admin panel, and a restart must
 * never revert those edits.
 */
@Injectable()
export class PermissionCatalogSeeder {
  constructor(
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(PermissionGroup)
    private readonly permissionGroupModel: typeof PermissionGroup,
    @InjectModel(UserPermissionGroup)
    private readonly userPermissionGroupModel: typeof UserPermissionGroup,
  ) {}

  /**
   * Existence-only check of the catalog: every system permission and group is
   * present. Contents are deliberately not compared — see the class comment.
   * Returns the administrators group when the catalog is complete.
   */
  async findSeededAdministratorsGroup(transaction: Transaction): Promise<PermissionGroup | null> {
    const permissionNames = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);
    const existingPermissions = await this.permissionModel.findAll({
      where: { name: permissionNames },
      paranoid: false,
      transaction,
    });
    const existingPermissionNames = new Set(existingPermissions.map((permission) => permission.name));
    if (permissionNames.some((permissionName) => !existingPermissionNames.has(permissionName))) {
      return null;
    }

    const groupKeys = SYSTEM_PERMISSION_GROUPS.map((group) => group.systemKey);
    const existingGroups = await this.permissionGroupModel.findAll({
      where: { systemKey: groupKeys },
      paranoid: false,
      transaction,
    });
    const groupsByKey = new Map(existingGroups.map((group) => [group.systemKey || '', group]));
    if (groupKeys.some((groupKey) => !groupsByKey.has(groupKey))) {
      return null;
    }
    return groupsByKey.get(SYSTEM_PERMISSION_GROUPS[0].systemKey) ?? null;
  }

  async hasGroupAssignment(userId: string, groupId: string, transaction: Transaction): Promise<boolean> {
    const assignment = await this.userPermissionGroupModel.findOne({
      where: { userId, permissionGroupId: groupId },
      transaction,
    });
    return Boolean(assignment);
  }

  /** Creates or restores the catalog and the system groups, and grants each group its system permissions. */
  async seedCatalog(transaction: Transaction): Promise<SystemGroups> {
    const permissions = await this.seedPermissions(transaction);
    const groups = await this.seedGroups(transaction);
    await this.seedGroupPermissions(permissions, groups, transaction);
    return groups;
  }

  private async seedPermissions(transaction: Transaction): Promise<Map<string, Permission>> {
    const permissions = new Map<string, Permission>();

    for (const definition of SYSTEM_PERMISSION_CATALOG) {
      const existingPermission = await this.permissionModel.findOne({
        where: { name: definition.key },
        paranoid: false,
        transaction,
      });

      if (existingPermission) {
        // Restore only: an existing permission may already have been renamed or
        // re-described from the admin panel, and that must survive restarts.
        await existingPermission.restore({ transaction });

        // The one exception is a missing description: it carries no operator
        // intent, and the admin panel renders it, so backfilling it is safe and
        // keeps permissions seeded by an older catalog readable.
        if (!existingPermission.description) {
          await existingPermission.update({ description: definition.description }, { transaction });
        }

        permissions.set(definition.key, existingPermission);
        continue;
      }

      const createdPermission = await this.permissionModel.create(
        {
          id: randomUUID(),
          name: definition.key,
          description: definition.description,
        },
        { transaction },
      );

      permissions.set(definition.key, createdPermission);
    }

    return permissions;
  }

  private async seedGroups(
    transaction: Transaction,
  ): Promise<Record<'administrators' | 'registeredUsers', PermissionGroup>> {
    const groups = {
      administrators: await this.upsertGroup(SYSTEM_PERMISSION_GROUPS[0], transaction),
      registeredUsers: await this.upsertGroup(SYSTEM_PERMISSION_GROUPS[1], transaction),
    };

    return groups;
  }

  private async upsertGroup(
    definition: (typeof SYSTEM_PERMISSION_GROUPS)[number],
    transaction: Transaction,
  ): Promise<PermissionGroup> {
    const existingGroup = await this.permissionGroupModel.findOne({
      where: { systemKey: definition.systemKey },
      paranoid: false,
      transaction,
    });

    if (existingGroup) {
      // Restore only, so manual renames done via the admin panel persist.
      await existingGroup.restore({ transaction });
      return existingGroup;
    }

    return this.permissionGroupModel.create(
      {
        id: randomUUID(),
        name: definition.name,
        description: definition.description,
        systemKey: definition.systemKey,
        isSystem: true,
      },
      { transaction },
    );
  }

  private async seedGroupPermissions(
    permissions: Map<string, Permission>,
    groups: Record<'administrators' | 'registeredUsers', PermissionGroup>,
    transaction: Transaction,
  ): Promise<void> {
    await this.syncGroupPermissions(
      groups.administrators,
      SYSTEM_PERMISSION_GROUPS[0].permissionKeys,
      permissions,
      transaction,
    );
    await this.syncGroupPermissions(
      groups.registeredUsers,
      SYSTEM_PERMISSION_GROUPS[1].permissionKeys,
      permissions,
      transaction,
    );
  }

  private async syncGroupPermissions(
    group: PermissionGroup,
    permissionKeys: readonly string[],
    permissions: Map<string, Permission>,
    transaction: Transaction,
  ): Promise<void> {
    const resolvedPermissions = permissionKeys
      .map((permissionKey) => permissions.get(permissionKey))
      .filter((permission): permission is Permission => permission !== undefined);

    if (resolvedPermissions.length !== permissionKeys.length) {
      throw new InvariantViolationException(
        `Failed to resolve all permissions for system group ${group.systemKey || group.name}`,
      );
    }

    // Additive only. `$set` would drop permissions that an admin granted to a
    // system group through the admin panel; the seed must never revoke.
    await group.$add('permissions', resolvedPermissions, { transaction });
  }

  async ensureGroupAssignment(userId: string, groupId: string, transaction: Transaction): Promise<void> {
    const existingAssignment = await this.userPermissionGroupModel.findOne({
      where: {
        userId,
        permissionGroupId: groupId,
      },
      transaction,
    });

    if (existingAssignment) {
      return;
    }

    await this.userPermissionGroupModel.create(
      {
        userId,
        permissionGroupId: groupId,
      },
      { transaction },
    );
  }
}
