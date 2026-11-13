import { Module } from '@nestjs/common';

import { StorageModule } from '@/modules/storage/storage.module';
import { UsersModule } from '@/modules/users/users.module';

import { AvatarService } from './avatar.service';
import { AvatarsController } from './avatars.controller';

@Module({
  imports: [StorageModule, UsersModule],
  controllers: [AvatarsController],
  providers: [AvatarService],
})
export class AvatarsModule {}
