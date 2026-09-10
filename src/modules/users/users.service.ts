import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { PaginatedResponseDto, PaginationDto } from '@/common/dto/pagination.dto';
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

  /**
   * Creates a new user in the system.
   * @param createUserDto - User creation data
   * @returns Created user entity
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.debug(`Creating user with email: ${createUserDto.email}`);

    const user = await this.userModel.create({ ...createUserDto });

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
}
