import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

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

  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.debug(`Creating user with email: ${createUserDto.email}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await this.userModel.create(createUserDto as any);

    // Emit event as per guidelines
    this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email));

    return user;
  }

  async findAll(): Promise<User[]> {
    return this.userModel.findAll();
  }

  async findOne(id: string): Promise<User | null> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }
    return user;
  }

  async remove(id: string): Promise<void> {
    this.logger.debug(`Removing user with id: ${id}`);

    const user = await this.findOne(id);
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    await user.destroy(); // Soft delete because of paranoid: true

    this.eventEmitter.emit('user.deleted', new UserDeletedEvent(id));
  }
}
