import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';
import { User } from '@/modules/users/entities/user.entity';

import { SystemSeedService } from './system-seed.service';

@Module({
  imports: [SequelizeModule.forFeature([Permission, PermissionGroup, User, UserPermissionGroup])],
  providers: [SystemSeedService],
  exports: [SystemSeedService],
})
export class SystemSeedModule {}
