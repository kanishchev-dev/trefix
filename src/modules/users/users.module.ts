import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { MailerModule } from '@/modules/mailer/mailer.module';
import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { SettingsModule } from '@/modules/settings/settings.module';

import { User } from './entities/user.entity';
import { UserCreatedListener } from './listeners/user-created.listener';
import { UserDeletedListener } from './listeners/user-deleted.listener';
import { UserInvitedListener } from './listeners/user-invited.listener';
import { UserUpdatedListener } from './listeners/user-updated.listener';
import { AdminUsersService } from './services/admin-users.service';
import { SystemAdminSeeder } from './services/system-admin-seeder.service';
import { UserInviteService } from './services/user-invite.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([User]), PermissionsModule, MailerModule, RealtimeModule, SettingsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AdminUsersService,
    UserInviteService,
    UserCreatedListener,
    UserDeletedListener,
    UserUpdatedListener,
    UserInvitedListener,
    SystemAdminSeeder,
  ],
  exports: [UsersService, UserInviteService, SystemAdminSeeder],
})
export class UsersModule {}
