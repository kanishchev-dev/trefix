import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionGroupPermission } from './entities/permission-group-permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { UserPermissionGroup } from './entities/user-permission-group.entity';
import { PermissionsCacheListener } from './listeners/permissions-cache.listener';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionCatalogSeeder } from './services/permission-catalog-seeder.service';
import { UserPermissionsService } from './services/user-permissions.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Permission,
      PermissionGroup,
      PermissionGroupPermission,
      UserPermission,
      UserPermissionGroup,
    ]),
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, UserPermissionsService, PermissionsCacheListener, PermissionCatalogSeeder],
  exports: [PermissionsService, UserPermissionsService, PermissionCatalogSeeder],
})
export class PermissionsModule {}
