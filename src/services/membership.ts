import { PrismaClient } from '@prisma/client';

export class MembershipService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Checks if a user is an active member or guest on a specific date in the group.
   * Guest users (role = GUEST) bypass membership checks.
   * Standard users (role = MEMBER) are checked against their joinedAt/leftAt dates.
   */
  async isUserActiveOnDate(groupId: string, userId: string, date: Date): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) return false;
    
    // Guest users bypass permanent membership checks
    if (user.role === 'GUEST') return true;

    // Fetch the group membership boundaries
    const membership = await this.prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) return false;

    const joinedAt = new Date(membership.joinedAt);
    const leftAt = membership.leftAt ? new Date(membership.leftAt) : null;

    // Compare date boundaries
    if (date < joinedAt) return false;
    if (leftAt && date > leftAt) return false;

    return true;
  }

  /**
   * Returns the list of active user IDs in the group on a specific date.
   */
  async getActiveRosterOnDate(groupId: string, date: Date): Promise<string[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        groupId,
        joinedAt: { lte: date },
        OR: [
          { leftAt: null },
          { leftAt: { gte: date } },
        ],
      },
      select: {
        userId: true,
      },
    });

    return memberships.map((m) => m.userId);
  }
}
