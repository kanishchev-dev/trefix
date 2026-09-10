import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { MailerModule } from '@/modules/mailer/mailer.module';
import { RealtimeModule } from '@/modules/realtime/realtime.module';

import { User } from './entities/user.entity';
import { UserCreatedListener } from './listeners/user-created.listener';
import { UserDeletedListener } from './listeners/user-deleted.listener';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([User]), MailerModule, RealtimeModule],
  controllers: [UsersController],
  providers: [UsersService, UserCreatedListener, UserDeletedListener],
  exports: [UsersService],
})
export class UsersModule {}
