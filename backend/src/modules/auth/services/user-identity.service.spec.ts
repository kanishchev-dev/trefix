import { EventEmitter2 } from '@nestjs/event-emitter';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { UsersService } from '@/modules/users/users.service';

import { UserIdentity } from '../entities/user-identity.entity';
import { UserIdentityService } from './user-identity.service';

const profile = { email: 'Runner@Example.com', firstName: '', lastName: '', providerSubject: 'sub-1' };

describe('UserIdentityService', () => {
  let identityModel: { findOne: jest.Mock; create: jest.Mock; destroy: jest.Mock; findAll: jest.Mock };
  let usersService: { findOne: jest.Mock; findByEmail: jest.Mock; create: jest.Mock; update: jest.Mock };
  let service: UserIdentityService;

  beforeEach(() => {
    identityModel = { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn(), findAll: jest.fn() };
    usersService = { findOne: jest.fn(), findByEmail: jest.fn(), create: jest.fn(), update: jest.fn() };
    service = new UserIdentityService(
      identityModel as unknown as typeof UserIdentity,
      usersService as unknown as UsersService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
  });

  it('signs in the owner of a known provider account even if the email differs', async () => {
    identityModel.findOne.mockResolvedValueOnce({ userId: 'user-1' });
    usersService.findOne.mockResolvedValue({ id: 'user-1', email: 'other@example.com' });

    await expect(service.resolveUser('apple', profile)).resolves.toMatchObject({ id: 'user-1' });
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('falls back to the email match and remembers the identity', async () => {
    identityModel.findOne.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue({ id: 'user-2' });

    await service.resolveUser('google', profile);

    expect(usersService.findByEmail).toHaveBeenCalledWith('runner@example.com');
    expect(identityModel.create).toHaveBeenCalledWith({
      userId: 'user-2',
      provider: 'google',
      subject: 'sub-1',
      email: 'runner@example.com',
    });
  });

  it('drops an identity whose account was deleted', async () => {
    const stale = { userId: 'gone', destroy: jest.fn() };
    identityModel.findOne.mockResolvedValueOnce(stale).mockResolvedValue(null);
    usersService.findOne.mockRejectedValue(new EntityNotFoundException('User', 'gone'));
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({ id: 'user-3' });

    await expect(service.resolveUser('apple', profile)).resolves.toMatchObject({ id: 'user-3' });
    expect(stale.destroy).toHaveBeenCalled();
  });

  it('creates a new account with the name the provider sent', async () => {
    identityModel.findOne.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({ id: 'user-4' });

    await service.resolveUser('apple', { ...profile, firstName: 'Viktor', lastName: 'K' });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Viktor', lastName: 'K', email: 'runner@example.com' }),
    );
  });

  it('replaces a name made from the email with the provider name', async () => {
    identityModel.findOne.mockResolvedValueOnce({ userId: 'user-5' });
    const owner = { id: 'user-5', email: 'runner@example.com', firstName: 'runner', lastName: '' };
    usersService.findOne.mockResolvedValue(owner);
    usersService.update.mockResolvedValue({ ...owner, firstName: 'Viktor' });

    await service.resolveUser('apple', { ...profile, firstName: 'Viktor' });

    expect(usersService.update).toHaveBeenCalledWith('user-5', { firstName: 'Viktor', lastName: '' });
  });

  it('keeps a name the user set', async () => {
    identityModel.findOne.mockResolvedValueOnce({ userId: 'user-6' });
    usersService.findOne.mockResolvedValue({
      id: 'user-6',
      email: 'runner@example.com',
      firstName: 'Витя',
      lastName: '',
    });

    await service.resolveUser('apple', { ...profile, firstName: 'Viktor' });

    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('refuses to link an account that belongs to another user', async () => {
    identityModel.findOne.mockResolvedValueOnce({ userId: 'someone-else' });

    await expect(service.link('user-1', 'apple', profile)).rejects.toMatchObject({ code: 'AUTH_IDENTITY_IN_USE' });
  });

  it('reports unlinking an account that is not linked', async () => {
    identityModel.destroy.mockResolvedValue(0);

    await expect(service.unlink('user-1', 'google')).rejects.toMatchObject({ code: 'AUTH_IDENTITY_NOT_FOUND' });
  });
});
