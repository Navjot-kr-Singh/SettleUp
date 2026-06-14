import { PrismaClient, MembershipEventType } from '@prisma/client';

export class GroupRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createGroup(name: string) {
    return this.prisma.group.create({
      data: { name },
    });
  }

  async findGroupById(id: string) {
    return this.prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { user: true },
        },
      },
    });
  }

  async findGroupByName(name: string) {
    return this.prisma.group.findUnique({
      where: { name },
    });
  }

  async listGroups() {
    return this.prisma.group.findMany({
      include: {
        memberships: true,
      },
    });
  }

  async addMemberToGroup(groupId: string, userId: string, joinedAt: Date = new Date()) {
    return this.prisma.groupMembership.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      update: {
        leftAt: null, // Reactivate if previously left
        joinedAt,
      },
      create: {
        groupId,
        userId,
        joinedAt,
      },
    });
  }

  async removeMemberFromGroup(groupId: string, userId: string, leftAt: Date = new Date()) {
    return this.prisma.groupMembership.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: {
        leftAt,
      },
    });
  }

  async createMembershipHistory(
    groupId: string,
    userId: string,
    eventType: MembershipEventType,
    eventDate: Date,
    notes?: string
  ) {
    return this.prisma.membershipHistory.create({
      data: {
        groupId,
        userId,
        eventType,
        eventDate,
        notes,
      },
    });
  }

  async getMembershipHistory(groupId: string) {
    return this.prisma.membershipHistory.findMany({
      where: { groupId },
      orderBy: { eventDate: 'asc' },
      include: {
        user: true,
      },
    });
  }
}
