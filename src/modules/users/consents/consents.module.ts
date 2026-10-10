import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { UserConsent } from './user-consent.entity';
import { UserConsentsController } from './user-consents.controller';
import { UserConsentsService } from './user-consents.service';

/** Versioned user consents (health data processing); imported by integrations. */
@Module({
  imports: [SequelizeModule.forFeature([UserConsent])],
  controllers: [UserConsentsController],
  providers: [UserConsentsService],
  exports: [UserConsentsService],
})
export class ConsentsModule {}
