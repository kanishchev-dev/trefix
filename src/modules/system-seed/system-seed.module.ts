import { Module } from '@nestjs/common';

import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { UsersModule } from '@/modules/users/users.module';

import { SystemSeedService } from './system-seed.service';

@Module({
  imports: [PermissionsModule, UsersModule],
  providers: [SystemSeedService],
  exports: [SystemSeedService],
})
export class SystemSeedModule {}
