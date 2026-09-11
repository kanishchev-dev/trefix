import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';

import appConfig from '@/config/app.config';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';
import { User } from '@/modules/users/entities/user.entity';

import {
  SYSTEM_ADMIN_USER,
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_PERMISSION_GROUPS,
} from '../permissions/constants/system-access.constants';

interface BcryptLike {
  hash(password: string, saltRounds: number): Promise<string>;
}

@Injectable()
export class SystemSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemSeedService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
    private readonly configService: ConfigService,
    @InjectConnection()
    private readonly sequelize: Sequelize,
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(PermissionGroup)
    private readonly permissionGroupModel: typeof PermissionGroup,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(UserPermissionGroup)
    private readonly userPermissionGroupModel: typeof UserPermissionGroup,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.appConfiguration.autoSeedSystemData) {
      this.logger.debug('Automatic system seeding is disabled');
      return;
    }

    if (!(await this.areSystemTablesReady())) {
      this.logger.warn('System seed data skipped because the database schema is not ready yet');
      return;
    }

    await this.seedSystemData();
  }

  private async areSystemTablesReady(): Promise<boolean> {
    const requiredTables = [
      'permissions',
      'permission_groups',
      'permission_group_permissions',
      'users',
      'user_permission_groups',
    ] as const;

    for (const tableName of requiredTables) {
      const result = await this.sequelize.query<{ exists: boolean }>(
        'SELECT to_regclass(:tableName) IS NOT NULL AS "exists"',
        {
          replacements: {
            tableName,
          },
          plain: true,
          raw: true,
          type: QueryTypes.SELECT,
        },
      );

      if (!result || !result.exists) {
        return false;
      }
    }

    return true;
  }

  async seedSystemData(): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      if (await this.isSystemSeedComplete(transaction)) {
        this.logger.debug('System seed data already exists; skipping');
        return;
      }

      const permissions = await this.seedPermissions(transaction);
      const groups = await this.seedGroups(transaction);
      await this.seedGroupPermissions(permissions, groups, transaction);
      const adminUser = await this.seedAdminUser(transaction);
      await this.seedAdminAssignment(adminUser.id, groups.administrators.id, transaction);
    });

    this.logger.log('System seed data is up to date');
  }

  private async isSystemSeedComplete(transaction: Transaction): Promise<boolean> {
    const permissionNames = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);
    const groupKeys = SYSTEM_PERMISSION_GROUPS.map((group) => group.systemKey);

    const existingPermissions = await this.permissionModel.findAll({
      where: {
        name: permissionNames,
      },
      paranoid: false,
      transaction,
    });

    if (existingPermissions.length !== permissionNames.length) {
      return false;
    }

    const permissionsByName = new Map(existingPermissions.map((permission) => [permission.name, permission]));
    if (permissionNames.some((permissionName) => !permissionsByName.has(permissionName))) {
      return false;
    }

    const existingGroups = await this.permissionGroupModel.findAll({
      where: {
        systemKey: groupKeys,
      },
      paranoid: false,
      transaction,
    });

    if (existingGroups.length !== groupKeys.length) {
      return false;
    }

    const groupsByKey = new Map(existingGroups.map((group) => [group.systemKey || '', group]));
    if (groupKeys.some((groupKey) => !groupsByKey.has(groupKey))) {
      return false;
    }

    const adminUser = await this.userModel.findOne({
      where: {
        systemKey: SYSTEM_ADMIN_USER.systemKey,
      },
      paranoid: false,
      transaction,
    });

    if (!adminUser) {
      return false;
    }

    const adminAssignment = await this.userPermissionGroupModel.findOne({
      where: {
        userId: adminUser.id,
        permissionGroupId: groupsByKey.get(SYSTEM_PERMISSION_GROUPS[0].systemKey)?.id,
      },
      transaction,
    });

    if (!adminAssignment) {
      return false;
    }

    const administratorsGroup = groupsByKey.get(SYSTEM_PERMISSION_GROUPS[0].systemKey);
    const registeredUsersGroup = groupsByKey.get(SYSTEM_PERMISSION_GROUPS[1].systemKey);

    if (!administratorsGroup || !registeredUsersGroup) {
      return false;
    }

    const [administratorsPermissions, registeredUsersPermissions] = await Promise.all([
      administratorsGroup.$get('permissions', { transaction }),
      registeredUsersGroup.$get('permissions', { transaction }),
    ]);

    return (
      this.hasExactPermissions(administratorsPermissions, SYSTEM_PERMISSION_GROUPS[0].permissionKeys) &&
      this.hasExactPermissions(registeredUsersPermissions, SYSTEM_PERMISSION_GROUPS[1].permissionKeys)
    );
  }

  private hasExactPermissions(permissions: Permission[], expectedNames: readonly string[]): boolean {
    if (permissions.length !== expectedNames.length) {
      return false;
    }

    const actualNames = new Set(permissions.map((permission) => permission.name));
    return expectedNames.every((permissionName) => actualNames.has(permissionName));
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
        await existingPermission.restore({ transaction });
        await existingPermission.update(
          {
            name: definition.key,
            description: definition.description,
          },
          { transaction },
        );
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
      await existingGroup.restore({ transaction });
      await existingGroup.update(
        {
          name: definition.name,
          description: definition.description,
          systemKey: definition.systemKey,
          isSystem: true,
        },
        { transaction },
      );
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
    await this.syncGroupPermissions(groups.administrators, SYSTEM_PERMISSION_GROUPS[0].permissionKeys, permissions, transaction);
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
      throw new Error(`Failed to resolve all permissions for system group ${group.systemKey || group.name}`);
    }

    await group.$set('permissions', resolvedPermissions, { transaction });
  }

  private async seedAdminUser(transaction: Transaction): Promise<User> {
    const bcrypt = require('bcryptjs') as BcryptLike;
    const adminEmail = this.configService.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const existingAdmin = await this.userModel.findOne({
      where: { systemKey: SYSTEM_ADMIN_USER.systemKey },
      paranoid: false,
      transaction,
    });

    if (existingAdmin) {
      await existingAdmin.restore({ transaction });
      await existingAdmin.update(
        {
          email: adminEmail,
          firstName: SYSTEM_ADMIN_USER.firstName,
          lastName: SYSTEM_ADMIN_USER.lastName,
          passwordHash,
          systemKey: SYSTEM_ADMIN_USER.systemKey,
          isSystem: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
        },
        { transaction },
      );
      return existingAdmin;
    }

    return this.userModel.create(
      {
        id: randomUUID(),
        email: adminEmail,
        firstName: SYSTEM_ADMIN_USER.firstName,
        lastName: SYSTEM_ADMIN_USER.lastName,
        passwordHash,
        systemKey: SYSTEM_ADMIN_USER.systemKey,
        isSystem: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      { transaction },
    );
  }

  private async seedAdminAssignment(
    userId: string,
    groupId: string,
    transaction: Transaction,
  ): Promise<void> {
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
