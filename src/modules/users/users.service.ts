import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, UniqueConstraintError, where as sequelizeWhere } from 'sequelize';

import { PaginatedResponseDto, PaginationDto } from '@/common/dto/pagination.dto';
import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserCreatedEvent } from './events/user-created.event';
import { UserDeletedEvent } from './events/user-deleted.event';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private eventEmitter: EventEmitter2,
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

    // Emit event as per guidelines
    this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email, user.firstName, user.lastName));

    return user;
  }

  /**
   * Retrieves all users.
   * @param pagination - Pagination options
   * @returns Paginated list of user entities
   */
  async findAll(pagination: PaginationDto = new PaginationDto()): Promise<PaginatedResponseDto<User>> {
    const { page = 1, limit = 10 } = pagination;
    const { rows, count } = await this.userModel.findAndCountAll({
      limit,
      offset: (page - 1) * limit,
    });

    return new PaginatedResponseDto(rows, count, page, limit);
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
