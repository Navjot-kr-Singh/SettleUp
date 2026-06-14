import { PrismaClient, UserRole } from '@prisma/client';

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findUserByName(name: string) {
    return this.prisma.user.findFirst({
      where: { name },
    });
  }

  async createUser(name: string, email?: string, passwordHash?: string, isGuest: boolean = false, role: UserRole = UserRole.MEMBER) {
    return this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isGuest,
        role,
      },
    });
  }

  async listUsers() {
    return this.prisma.user.findMany();
  }
}
