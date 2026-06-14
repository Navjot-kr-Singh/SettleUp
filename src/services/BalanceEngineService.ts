import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface UserBalanceItem {
  userId: string;
  netBalance: number;
}

export class BalanceEngineService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Sums active expenses and settlements to compute raw balances.
   */
  async calculateBalances(groupId: string): Promise<Record<string, Decimal>> {
    // 1. Fetch all active (non-deleted) expenses with participants
    const expenses = await this.prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      include: { participants: true },
    });

    // 2. Fetch all settlements
    const settlements = await this.prisma.settlement.findMany({
      where: { groupId },
    });

    // 3. Initialize user balances map
    const balances: Record<string, Decimal> = {};

    // Get all users who are members of the group
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId },
      select: { userId: true },
    });
    memberships.forEach((m) => {
      balances[m.userId] = new Decimal(0);
    });

    // Include any user who paid or participated in expenses (such as guest users or past members)
    expenses.forEach((e) => {
      if (!balances[e.paidById]) balances[e.paidById] = new Decimal(0);
      e.participants.forEach((p) => {
        if (!balances[p.userId]) balances[p.userId] = new Decimal(0);
      });
    });
    settlements.forEach((s) => {
      if (!balances[s.senderId]) balances[s.senderId] = new Decimal(0);
      if (!balances[s.receiverId]) balances[s.receiverId] = new Decimal(0);
    });

    // 4. Calculate expense impacts
    expenses.forEach((e) => {
      const payerId = e.paidById;
      balances[payerId] = balances[payerId].plus(e.baseCurrencyAmount);

      e.participants.forEach((p) => {
        balances[p.userId] = balances[p.userId].minus(p.calculatedAmount);
      });
    });

    // 5. Calculate settlement impacts
    settlements.forEach((s) => {
      const senderId = s.senderId;
      const receiverId = s.receiverId;
      balances[senderId] = balances[senderId].plus(s.baseCurrencyAmount);
      balances[receiverId] = balances[receiverId].minus(s.baseCurrencyAmount);
    });

    return balances;
  }

  /**
   * Rebuilds the balance snapshot inside a transaction.
   */
  async rebuildSnapshot(groupId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch latest snapshot version
      const latest = await tx.balanceSnapshot.findFirst({
        where: { groupId },
        orderBy: { version: 'desc' },
      });

      const nextVersion = latest ? latest.version + 1 : 1;

      // 2. Mark previous snapshots as isCurrent = false
      await tx.balanceSnapshot.updateMany({
        where: { groupId, isCurrent: true },
        data: { isCurrent: false },
      });

      // 3. Compute fresh balances
      const calculated = await this.calculateBalances(groupId);
      const balanceList = Object.entries(calculated).map(([userId, bal]) => ({
        userId,
        netBalance: bal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      }));

      // 4. Create new snapshot record
      return tx.balanceSnapshot.create({
        data: {
          groupId,
          balances: balanceList,
          version: nextVersion,
          isCurrent: true,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });
  }

  /**
   * Retrieves current cached balances for a group, generating one if missing.
   */
  async getGroupBalances(groupId: string): Promise<UserBalanceItem[]> {
    const snapshot = await this.prisma.balanceSnapshot.findFirst({
      where: { groupId, isCurrent: true },
    });

    if (snapshot) {
      return snapshot.balances as unknown as UserBalanceItem[];
    }

    // Otherwise, rebuild the snapshot and return its balances
    const newSnapshot = await this.rebuildSnapshot(groupId);
    return newSnapshot.balances as unknown as UserBalanceItem[];
  }

  /**
   * Returns user's balances across all groups they belong to.
   */
  async getUserBalancesAcrossGroups(userId: string) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId },
      include: { group: true },
    });

    const results = [];
    let grandTotal = new Decimal(0);

    for (const m of memberships) {
      const groupBalances = await this.getGroupBalances(m.groupId);
      const userBal = groupBalances.find((b) => b.userId === userId);
      const net = userBal ? userBal.netBalance : 0;
      
      results.push({
        groupId: m.groupId,
        groupName: m.group.name,
        netBalance: net,
      });
      grandTotal = grandTotal.plus(net);
    }

    return {
      userId,
      grandTotal: grandTotal.toNumber(),
      groupBalances: results,
    };
  }
}
