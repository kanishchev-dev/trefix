import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';

import { hashPassword } from '@/common/utils/password-hash.util';
import { SYSTEM_ADMIN_USER } from '@/modules/permissions/constants/system-access.constants';

import { User } from '../entities/user.entity';

/** bcrypt cost of the bootstrap admin password. */
const ADMIN_PASSWORD_HASH_ROUNDS = 12;

/** Creates the initial system administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. */
@Injectable()
export class SystemAdminSeeder {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly configService: ConfigService,
  ) {}

  async find(transaction: Transaction): Promise<User | null> {
    return this.userModel.findOne({
      where: { systemKey: SYSTEM_ADMIN_USER.systemKey },
      paranoid: false,
      transaction,
    });
  }

  async ensure(transaction: Transaction): Promise<User> {
    const existingAdmin = await this.userModel.findOne({
      where: { systemKey: SYSTEM_ADMIN_USER.systemKey },
      paranoid: false,
      transaction,
    });

    if (existingAdmin) {
      // Never reset an existing admin's credentials: the password may have
      // been changed from the admin panel after the initial bootstrap.
      await existingAdmin.restore({ transaction });
      return existingAdmin;
    }

    const adminEmail = this.configService.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
    const passwordHash = await hashPassword(adminPassword, ADMIN_PASSWORD_HASH_ROUNDS);

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
}
