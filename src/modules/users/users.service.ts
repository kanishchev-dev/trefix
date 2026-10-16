import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, UniqueConstraintError, where as sequelizeWhere, type WhereOptions } from 'sequelize';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { SystemEntityDeletionForbiddenException } from '@/common/exceptions/system-entity-deletion-forbidden.exception';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { SettingsService } from '@/modules/settings/settings.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './entities/user.entity';
import { UserCreatedEvent } from './events/user-created.event';
import { UserDeletedEvent } from './events/user-deleted.event';
import { UserUpdatedEvent } from './events/user-updated.event';
import { resolveUserStatus, type UserStatus } from './user-status';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private eventEmitter: EventEmitter2,
    private settingsService: SettingsService,
    private readonly userPermissionsService: UserPermissionsService,
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
        referralCode: this.normalizeReferralCode(createUserDto.referralCode) ?? null,
        passwordHash: createUserDto.passwordHash ?? null,
        emailVerified: createUserDto.emailVerified ?? false,
        emailVerifiedAt: createUserDto.emailVerified ? new Date() : null,
        passwordChangedAt: createUserDto.passwordHash ? new Date() : null,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw this.uniqueConflict(error, normalizedEmail, createUserDto.referralCode);
      }

      throw error;
    }

    await this.applyDefaultAssignments(user.id);

    // Emit event as per guidelines
    this.eventEmitter.emit(
      USERS_EVENTS.USER_CREATED,
      new UserCreatedEvent(user.id, user.email, user.firstName, user.lastName),
    );

    return user;
  }

  /** An empty referral code means "none": stored as null, so it never collides with other users. */
  private normalizeReferralCode(code: string | null | undefined): string | null | undefined {
    if (code === undefined) return undefined;
    const trimmed = code?.trim();
    return trimmed ? trimmed : null;
  }

  /** Names the unique column that was hit: email or referral code. */
  private uniqueConflict(
    error: UniqueConstraintError,
    email: string,
    referralCode: string | null | undefined,
  ): EntityAlreadyExistsException {
    if (error.fields && 'referral_code' in error.fields) {
      return new EntityAlreadyExistsException('User', 'referralCode', String(referralCode));
    }
    return new EntityAlreadyExistsException('User', 'email', email);
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

      await this.userPermissionsService.grantInitialAccess(userId, defaultGroups, defaultPermissions);
    } catch (error) {
      // Defaults must never block user creation; admin can fix assignments later.
      this.logger.warn(`Failed to apply default assignments for user ${userId}: ${(error as Error).message}`);
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const bio = dto.bio === undefined ? undefined : dto.bio?.trim() || null;
    await user.update({ ...dto, ...(bio === undefined ? {} : { bio }) });

    this.eventEmitter.emit(
      USERS_EVENTS.USER_UPDATED,
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
        ...(dto.referralCode !== undefined ? { referralCode: this.normalizeReferralCode(dto.referralCode) } : {}),
        emailVerified,
        emailVerifiedAt: emailVerified ? (emailChanged ? new Date() : user.emailVerifiedAt) : null,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw this.uniqueConflict(error, dto.email ?? user.email, dto.referralCode);
      }

      throw error;
    }

    this.eventEmitter.emit(
      USERS_EVENTS.USER_UPDATED,
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
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'DESC', status } = query;

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

    const statusFilter = this.statusFilter(status);
    const conditions = [searchFilter, statusFilter].filter((condition) => condition !== undefined);

    const { rows, count } = await this.userModel.findAndCountAll({
      where: conditions.length > 0 ? { [Op.and]: conditions } : undefined,
      paranoid: status !== 'deleted',
      limit,
      offset: (page - 1) * limit,
      order: [[col(this.toColumnName(sortBy)), sortOrder]],
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  /** `isUserBlocked` expressed as a query; deleted accounts are only listed when asked for. */
  private statusFilter(status: UserStatus | undefined): WhereOptions<User> | undefined {
    const now = new Date();
    const blocked: WhereOptions<User> = {
      blockedAt: { [Op.ne]: null },
      [Op.or]: [{ blockedUntil: null }, { blockedUntil: { [Op.gt]: now } }],
    };
    switch (status) {
      case 'deleted':
        return { deletedAt: { [Op.ne]: null } };
      case 'blocked':
        return blocked;
      case 'active':
        return { [Op.not]: blocked } as WhereOptions<User>;
      default:
        return undefined;
    }
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
    // Deleted accounts stay visible to administrators until purged, so they can be restored.
    const user = await this.userModel.findByPk(id, { paranoid: false });
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }
    const { groups, individualPermissions, effectivePermissions } = await this.userPermissionsService.getAccessSummary(
      user.id,
    );

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
      status: resolveUserStatus(user),
      blockedAt: user.blockedAt,
      blockedUntil: user.blockedUntil,
      blockedReason: user.blockedReason,
      deletedAt: user.deletedAt ?? null,
      groups,
      individualPermissions,
      effectivePermissions,
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
   * Accounts that may receive notifications: not deleted, not blocked, not
   * system. Filters narrow the set; `ids` limits it to the given users.
   */
  async findActiveRecipientIds(
    filter: { ids?: readonly string[]; registeredFrom?: Date; registeredTo?: Date } = {},
    now: Date = new Date(),
  ): Promise<string[]> {
    const createdAt: Record<symbol, Date> = {};
    if (filter.registeredFrom) {
      createdAt[Op.gte] = filter.registeredFrom;
    }
    if (filter.registeredTo) {
      createdAt[Op.lte] = filter.registeredTo;
    }
    const users = await this.userModel.findAll({
      where: {
        isSystem: false,
        ...(filter.ids ? { id: { [Op.in]: [...filter.ids] } } : {}),
        ...(Object.getOwnPropertySymbols(createdAt).length > 0 ? { createdAt } : {}),
        [Op.or]: [{ blockedAt: null }, { blockedUntil: { [Op.ne]: null, [Op.lte]: now } }],
      },
      attributes: ['id'],
    });
    return users.map((user) => user.id);
  }

  /**
   * Display names of the given users, including soft-deleted ones, for lists
   * that reference people (activity history). Unknown ids are absent.
   */
  async findDisplayNames(ids: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.userModel.findAll({
      where: { id: { [Op.in]: unique } },
      attributes: ['id', 'firstName', 'lastName', 'email'],
      paranoid: false,
    });
    return new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim() || user.email] as [string, string]),
    );
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

    this.eventEmitter.emit(USERS_EVENTS.USER_DELETED, new UserDeletedEvent(id));
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User> {
    const user = await this.findOne(id);
    return user.update({
      passwordHash,
      passwordChangedAt: new Date(),
    });
  }

  /** Sets a new, already confirmed email; the caller has verified ownership with a code. */
  async changeEmail(id: string, email: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing && existing.id !== id) {
      throw new EntityAlreadyExistsException('User', 'email', email);
    }
    const user = await this.findOne(id);
    await user.update({ email, emailVerified: true, emailVerifiedAt: new Date() });
    this.eventEmitter.emit(
      USERS_EVENTS.USER_UPDATED,
      new UserUpdatedEvent(user.id, user.email, user.firstName, user.lastName, user.avatarUrl),
    );
    return user;
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
