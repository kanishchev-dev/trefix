import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, UniqueConstraintError, where as sequelizeWhere } from 'sequelize';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { SystemEntityDeletionForbiddenException } from '@/common/exceptions/system-entity-deletion-forbidden.exception';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { SettingsService } from '@/modules/settings/settings.service';

import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './entities/user.entity';
import { UserCreatedEvent } from './events/user-created.event';
import { UserDeletedEvent } from './events/user-deleted.event';
import { UserUpdatedEvent } from './events/user-updated.event';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private eventEmitter: EventEmitter2,
    private settingsService: SettingsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.userModel.findOne({
      where: sequelizeWhere(fn('lower', col('email')), normalizedEmail),
    });
  }

  /**
   * Creates a new user in the system.
   * @param createUserDto - User creation data
   * @returns Created user entity
   */
  async create(
    createUserDto: CreateUserDto & {
      passwordHash?: string | null;
      emailVerified?: boolean;
      avatarUrl?: string | null;
      referralCode?: string | null;
    },
  ): Promise<User> {
    const normalizedEmail = this.normalizeEmail(createUserDto.email);
    this.logger.debug(`Creating user with email: ${normalizedEmail}`);

    const existingUser = await this.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new EntityAlreadyExistsException('User', 'email', normalizedEmail);
    }

    let user: User;
    try {
      user = await this.userModel.create({
        ...createUserDto,
        email: normalizedEmail,
        passwordHash: createUserDto.passwordHash ?? null,
        emailVerified: createUserDto.emailVerified ?? false,
        emailVerifiedAt: createUserDto.emailVerified ? new Date() : null,
        passwordChangedAt: createUserDto.passwordHash ? new Date() : null,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new EntityAlreadyExistsException('User', 'email', normalizedEmail);
      }

      throw error;
    }

    await this.applyDefaultAssignments(user.id);

    // Emit event as per guidelines
    this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email, user.firstName, user.lastName));

    return user;
  }

  /**
   * Assigns the groups and individual permissions configured in the global
   * settings as defaults for newly created users.
   */
  private async applyDefaultAssignments(userId: string): Promise<void> {
    try {
      const { defaultGroups, defaultPermissions } = await this.settingsService.getDefaultAssignments();

      if (defaultGroups.length === 0 && defaultPermissions.length === 0) {
        return;
      }

      const user = await this.userModel.findByPk(userId);
      if (!user) {
        return;
      }

      if (defaultGroups.length > 0) {
        await user.$add('permissionGroups', defaultGroups);
      }
      if (defaultPermissions.length > 0) {
        await user.$add('individualPermissions', defaultPermissions);
      }
    } catch (error) {
      // Defaults must never block user creation; admin can fix assignments later.
      this.logger.warn(`Failed to apply default assignments for user ${userId}: ${(error as Error).message}`);
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    await user.update(dto);

    this.eventEmitter.emit(
      'user.updated',
      new UserUpdatedEvent(user.id, user.email, user.firstName, user.lastName, user.avatarUrl),
    );

    return user;
  }

  /**
   * Admin-side user profile update. Supports email, verification status and
   * referral code changes in addition to the self-service fields.
   * @param id - User UUID
   * @param dto - Admin update payload
   * @returns Updated user entity
   */
  async adminUpdate(id: string, dto: AdminUpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email);
      if (existingUser && existingUser.id !== user.id) {
        throw new EntityAlreadyExistsException('User', 'email', dto.email);
      }
    }

    const emailChanged = Boolean(dto.email && dto.email !== user.email);
    // New or unverified email resets verification state; explicit flag wins.
    const emailVerified =
      dto.emailVerified !== undefined ? dto.emailVerified : emailChanged ? false : user.emailVerified;

    try {
      await user.update({
        ...dto,
        emailVerified,
        emailVerifiedAt: emailVerified ? (emailChanged ? new Date() : user.emailVerifiedAt) : null,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new EntityAlreadyExistsException('User', 'email', String(dto.email));
      }

      throw error;
    }

    this.eventEmitter.emit(
      'user.updated',
      new UserUpdatedEvent(user.id, user.email, user.firstName, user.lastName, user.avatarUrl),
    );

    return user;
  }

  /**
   * Retrieves all users with free-text search and sorting support.
   * @param query - Pagination, search and sorting options
   * @returns Paginated list of user entities
   */
  async findAll(query: UserQueryDto = new UserQueryDto()): Promise<PaginatedResponseDto<User>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const searchPattern = search ? `%${this.escapeLikePattern(search.toLowerCase())}%` : null;

    const searchFilter = searchPattern
      ? {
          [Op.or]: [
            sequelizeWhere(fn('lower', col('email')), { [Op.like]: searchPattern }),
            sequelizeWhere(fn('lower', col('first_name')), { [Op.like]: searchPattern }),
            sequelizeWhere(fn('lower', col('last_name')), { [Op.like]: searchPattern }),
          ],
        }
      : undefined;

    const { rows, count } = await this.userModel.findAndCountAll({
      where: searchFilter,
      limit,
      offset: (page - 1) * limit,
      order: [[col(this.toColumnName(sortBy)), sortOrder]],
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  private toColumnName(field: string): string {
    const mapping: Record<string, string> = {
      createdAt: 'created_at',
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
    };

    return mapping[field] ?? field;
  }

  /**
   * Escapes LIKE wildcards so user input is matched literally.
   * Bind parameters protect against SQL injection, but not against
   * `%`/`_` acting as wildcards inside the pattern.
   */
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`);
  }

  /**
   * Loads the aggregated admin detail for a user: profile fields plus
   * assigned groups, individual permissions and effective permissions.
   * @param id - User UUID
   * @returns Aggregated admin detail payload
   * @throws EntityNotFoundException if user is not found
   */
  async findAdminDetail(id: string): Promise<AdminUserResponseDto> {
    const user = await this.userModel.findByPk(id, {
      include: [
        {
          model: PermissionGroup,
          as: 'permissionGroups',
          through: { attributes: [] },
          include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
        },
        { model: Permission, as: 'individualPermissions', through: { attributes: [] } },
      ],
    });

    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    const groups = (user.permissionGroups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      systemKey: group.systemKey,
      isSystem: group.isSystem,
    }));

    const individualPermissions = (user.individualPermissions ?? []).map((permission) => ({
      name: permission.name,
      description: permission.description,
    }));

    const effectivePermissions = new Set<string>(individualPermissions.map((permission) => permission.name));
    for (const group of user.permissionGroups ?? []) {
      for (const permission of group.permissions ?? []) {
        effectivePermissions.add(permission.name);
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      referralCode: user.referralCode,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      isSystem: user.isSystem,
      systemKey: user.systemKey,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordChangedAt: user.passwordChangedAt,
      groups,
      individualPermissions,
      effectivePermissions: [...effectivePermissions],
    };
  }

  /**
   * Finds a user by ID.
   * @param id - User UUID
   * @returns User entity
   * @throws EntityNotFoundException if user is not found
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }
    return user;
  }

  /**
   * Soft deletes a user.
   * @param id - User UUID
   */
  async remove(id: string): Promise<void> {
    this.logger.debug(`Removing user with id: ${id}`);

    const user = await this.findOne(id);
    if (user.isSystem) {
      throw new SystemEntityDeletionForbiddenException('user');
    }

    await user.destroy(); // Soft delete because of paranoid: true

    this.eventEmitter.emit('user.deleted', new UserDeletedEvent(id));
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User> {
    const user = await this.findOne(id);
    return user.update({
      passwordHash,
      passwordChangedAt: new Date(),
    });
  }

  async setEmailVerified(id: string, emailVerified: boolean): Promise<User> {
    const user = await this.findOne(id);
    return user.update({
      emailVerified,
      emailVerifiedAt: emailVerified ? new Date() : null,
    });
  }

  async updatePasswordAndVerification(
    id: string,
    updates: {
      passwordHash?: string;
      emailVerified?: boolean;
    },
  ): Promise<User> {
    const user = await this.findOne(id);
    return user.update({
      passwordHash: updates.passwordHash,
      emailVerified: updates.emailVerified ?? user.emailVerified,
      emailVerifiedAt: updates.emailVerified ? new Date() : user.emailVerifiedAt,
      passwordChangedAt: updates.passwordHash ? new Date() : user.passwordChangedAt,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
