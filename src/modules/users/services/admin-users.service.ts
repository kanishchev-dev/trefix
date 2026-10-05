import { Injectable, Logger } from '@nestjs/common';

import { hashPassword } from '@/common/utils/password-hash.util';

import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { AdminUserResponseDto } from '../dto/admin-user-response.dto';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';
import { UserInviteService } from './user-invite.service';

const ADMIN_PASSWORD_HASH_ROUNDS = 12;

/**
 * Admin-facing user operations. Kept separate from the core UsersService so
 * the self-service profile logic and the admin management logic stay decoupled.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userInviteService: UserInviteService,
  ) {}

  /**
   * Creates a user from the admin panel with an immediate password
   * or leaves the account passwordless for the invite flow.
   * @param dto - Admin creation payload
   * @returns Created user entity
   */
  async createFromAdmin(dto: AdminCreateUserDto): Promise<User> {
    let passwordHash: string | null = null;
    if (dto.password) {
      passwordHash = await hashPassword(dto.password, ADMIN_PASSWORD_HASH_ROUNDS);
    }

    return this.usersService.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl,
      referralCode: dto.referralCode,
      passwordHash,
      // Admin-created users with an explicit password can log in right away.
      emailVerified: dto.emailVerified ?? Boolean(passwordHash),
    });
  }

  /**
   * Updates a user profile from the admin panel.
   * @param id - User UUID
   * @param dto - Admin update payload
   * @returns Updated user entity
   */
  async updateFromAdmin(id: string, dto: AdminUpdateUserDto): Promise<User> {
    return this.usersService.adminUpdate(id, dto);
  }

  /**
   * Sends the activation invite for a passwordless user.
   * @param id - User UUID
   */
  async inviteFromAdmin(id: string): Promise<void> {
    const user = await this.usersService.findOne(id);
    await this.userInviteService.inviteUser(user);
  }

  /**
   * Loads the aggregated admin detail for a user.
   * @param id - User UUID
   * @returns Aggregated admin detail payload
   */
  async getAdminDetail(id: string): Promise<AdminUserResponseDto> {
    return this.usersService.findAdminDetail(id);
  }

  /**
   * Soft deletes a user through the core service (system users are protected).
   * @param id - User UUID
   */
  async deleteFromAdmin(id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
