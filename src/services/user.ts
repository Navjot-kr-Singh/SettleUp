import { UserRepository } from '@/repositories/user.repo';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

export class UserService {
  private repo: UserRepository;

  constructor(repo: UserRepository) {
    this.repo = repo;
  }

  async getUserProfile(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isGuest: user.isGuest,
      isMember: user.role === UserRole.MEMBER,
    };
  }

  async createGuestUser(name: string) {
    const existing = await this.repo.findUserByName(name);
    if (existing) {
      throw new Error(`User with name '${name}' already exists.`);
    }
    const placeholderEmail = `guest-${crypto.randomUUID()}@settleup.local`;
    const placeholderHash = 'guest-account';
    return this.repo.createUser(name, placeholderEmail, placeholderHash, true, UserRole.GUEST);
  }
}
