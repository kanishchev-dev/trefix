import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';

import appConfig from '@/config/app.config';
import { PermissionCatalogSeeder } from '@/modules/permissions/services/permission-catalog-seeder.service';
import { SystemAdminSeeder } from '@/modules/users/services/system-admin-seeder.service';

/** Tables the seed writes to; seeding waits until migrations created all of them. */
const SYSTEM_TABLES = [
  'permissions',
  'permission_groups',
  'permission_group_permissions',
  'users',
  'user_permission_groups',
] as const;

/**
 * Bootstraps system data on startup: the permission catalog with system
 * groups (permissions module) and the initial administrator (users module),
 * in one transaction so a failed boot leaves nothing half-seeded.
 */
@Injectable()
export class SystemSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemSeedService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
    @InjectConnection()
    private readonly sequelize: Sequelize,
    private readonly catalogSeeder: PermissionCatalogSeeder,
    private readonly adminSeeder: SystemAdminSeeder,
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

  async seedSystemData(): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      if (await this.isSystemSeedComplete(transaction)) {
        this.logger.debug('System seed data already exists; skipping');
        return;
      }

      const groups = await this.catalogSeeder.seedCatalog(transaction);
      const adminUser = await this.adminSeeder.ensure(transaction);
      await this.catalogSeeder.ensureGroupAssignment(adminUser.id, groups.administrators.id, transaction);
    });

    this.logger.log('System seed data is up to date');
  }

  /**
   * Existence-only: the catalog, the admin and its group assignment exist.
   * Contents are never compared, so admin-panel edits survive restarts.
   */
  private async isSystemSeedComplete(transaction: Parameters<SystemAdminSeeder['find']>[0]): Promise<boolean> {
    const administrators = await this.catalogSeeder.findSeededAdministratorsGroup(transaction);
    if (!administrators) {
      return false;
    }
    const adminUser = await this.adminSeeder.find(transaction);
    if (!adminUser) {
      return false;
    }
    return this.catalogSeeder.hasGroupAssignment(adminUser.id, administrators.id, transaction);
  }

  private async areSystemTablesReady(): Promise<boolean> {
    for (const tableName of SYSTEM_TABLES) {
      const result = await this.sequelize.query<{ exists: boolean }>(
        'SELECT to_regclass(:tableName) IS NOT NULL AS "exists"',
        { replacements: { tableName }, plain: true, raw: true, type: QueryTypes.SELECT },
      );
      if (!result || !result.exists) {
        return false;
      }
    }
    return true;
  }
}
