import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { User } from '@/modules/users/entities/user.entity';

import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionGroupPermission } from './entities/permission-group-permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { UserPermissionGroup } from './entities/user-permission-group.entity';
import { PermissionsListener } from './listeners/permissions.listener';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Permission,
      PermissionGroup,
      PermissionGroupPermission,
      UserPermission,
      UserPermissionGroup,
      User,
    ]),
    RealtimeModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsListener],
  exports: [PermissionsService],
})
export class PermissionsModule {}
