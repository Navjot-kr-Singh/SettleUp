import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { SplitType, UserRole } from '@prisma/client';
import { BalanceEngineService } from '../../services/BalanceEngineService';
import { BalanceExplanationService } from '../../services/BalanceExplanationService';
import { DebtSimplificationService } from '../../services/DebtSimplificationService';

describe('SettleUp Balance Engine & Verification Suite', () => {
  describe('Zero-Sum Accounting Validation', () => {
    let mockPrisma: any;
    let balanceService: BalanceEngineService;

    beforeEach(() => {
      mockPrisma = {
        expense: { findMany: vi.fn() },
        settlement: { findMany: vi.fn() },
        groupMembership: { findMany: vi.fn() },
      };
      balanceService = new BalanceEngineService(mockPrisma as any);
    });

    const verifyZeroSum = (balances: Record<string, Decimal>) => {
      let sum = new Decimal(0);
      for (const val of Object.values(balances)) {
        sum = sum.plus(val);
      }
      expect(sum.toNumber()).toBeCloseTo(0, 5);
    };

    it('shouldMaintainZeroSumAfterExpenseCreation - Equal Split', async () => {
      // 1 expense of 3000 INR split equally among 3 members (Aisha, Rohan, Priya)
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
        { userId: 'u-priya' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-aisha',
          baseCurrencyAmount: new Decimal(3000),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(1000) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(1000) },
            { userId: 'u-priya', calculatedAmount: new Decimal(1000) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');

      expect(balances['u-aisha'].toNumber()).toBe(2000); // 3000 - 1000
      expect(balances['u-rohan'].toNumber()).toBe(-1000);
      expect(balances['u-priya'].toNumber()).toBe(-1000);

      verifyZeroSum(balances);
    });

    it('shouldMaintainZeroSumAfterExpenseCreation - Percentage Split', async () => {
      // 1 expense of 1000 INR split percentage: Aisha 50%, Rohan 30%, Priya 20%
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
        { userId: 'u-priya' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-rohan',
          baseCurrencyAmount: new Decimal(1000),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(500) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(300) },
            { userId: 'u-priya', calculatedAmount: new Decimal(200) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');
      verifyZeroSum(balances);
    });

    it('shouldMaintainZeroSumAfterExpenseCreation - Shares Split', async () => {
      // 1 expense of 1500 INR split shares: Aisha (2 shares), Rohan (1 share)
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-aisha',
          baseCurrencyAmount: new Decimal(1500),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(1000) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(500) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');
      verifyZeroSum(balances);
    });

    it('shouldMaintainZeroSumAfterSettlement', async () => {
      // Aisha paid 3000, Rohan and Priya owe 1000. Rohan settles 1000 to Aisha.
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
        { userId: 'u-priya' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-aisha',
          baseCurrencyAmount: new Decimal(3000),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(1000) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(1000) },
            { userId: 'u-priya', calculatedAmount: new Decimal(1000) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([
        {
          id: 's1',
          groupId: 'g1',
          senderId: 'u-rohan',
          receiverId: 'u-aisha',
          baseCurrencyAmount: new Decimal(1000),
        },
      ]);

      const balances = await balanceService.calculateBalances('g1');

      expect(balances['u-aisha'].toNumber()).toBe(1000); // 2000 - 1000
      expect(balances['u-rohan'].toNumber()).toBe(0); // -1000 + 1000
      expect(balances['u-priya'].toNumber()).toBe(-1000);

      verifyZeroSum(balances);
    });

    it('shouldMaintainZeroSumAfterCurrencyConversion', async () => {
      // Aisha pays 100 USD (converted to 8350 INR). Split equally Aisha & Rohan.
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-aisha',
          baseCurrencyAmount: new Decimal(8350),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(4175) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(4175) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');
      verifyZeroSum(balances);
    });

    it('shouldMaintainZeroSumWithGuestUsers', async () => {
      // Aisha paid 3000, split: Rohan (MEMBER, 1500) and Kabir (GUEST, 1500)
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          groupId: 'g1',
          paidById: 'u-aisha',
          baseCurrencyAmount: new Decimal(3000),
          participants: [
            { userId: 'u-rohan', calculatedAmount: new Decimal(1500) },
            { userId: 'u-kabir', calculatedAmount: new Decimal(1500) }, // Guest user
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');

      expect(balances['u-aisha'].toNumber()).toBe(3000);
      expect(balances['u-rohan'].toNumber()).toBe(-1500);
      expect(balances['u-kabir'].toNumber()).toBe(-1500);

      verifyZeroSum(balances);
    });
  });

  describe('Historical Membership Regression Tests', () => {
    let mockPrisma: any;
    let balanceService: BalanceEngineService;

    beforeEach(() => {
      mockPrisma = {
        expense: { findMany: vi.fn() },
        settlement: { findMany: vi.fn() },
        groupMembership: { findMany: vi.fn() },
      };
      balanceService = new BalanceEngineService(mockPrisma as any);
    });

    it('shouldPreserveHistoricalBalancesAfterMemberLeaves', async () => {
      // Scenario: Meera participates in February expense. Meera leaves in March.
      // Recalculating balances should keep February expense calculations intact.
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
        // Meera left but remains in list of memberships or we compute her balance
      ]);

      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e-feb',
          groupId: 'g1',
          paidById: 'u-aisha',
          date: new Date('2026-02-15T12:00:00Z'),
          baseCurrencyAmount: new Decimal(20000),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(5000) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(5000) },
            { userId: 'u-priya', calculatedAmount: new Decimal(5000) },
            { userId: 'u-meera', calculatedAmount: new Decimal(5000) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');

      // Meera's balance from February remains unchanged (-5000)
      expect(balances['u-meera']).toBeDefined();
      expect(balances['u-meera'].toNumber()).toBe(-5000);
    });

    it('shouldExcludeFutureMemberFromPastExpenses', async () => {
      // Scenario: Sam joins in April. March expenses exclude Sam.
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
        { userId: 'u-sam' }, // Sam is now in active database membership roster
      ]);

      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e-mar',
          groupId: 'g1',
          paidById: 'u-aisha',
          date: new Date('2026-03-10T12:00:00Z'),
          baseCurrencyAmount: new Decimal(1200),
          participants: [
            { userId: 'u-aisha', calculatedAmount: new Decimal(400) },
            { userId: 'u-rohan', calculatedAmount: new Decimal(400) },
            { userId: 'u-priya', calculatedAmount: new Decimal(400) },
            // Sam is NOT in participants list because splits were resolved in March
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([]);

      const balances = await balanceService.calculateBalances('g1');

      // Sam's balance for the March expense is 0
      expect(balances['u-sam'].toNumber()).toBe(0);
    });
  });

  describe('Snapshot Versioning Tests', () => {
    let snapshotsStore: any[];
    let mockPrisma: any;
    let balanceService: BalanceEngineService;

    beforeEach(() => {
      snapshotsStore = [];
      mockPrisma = {
        $transaction: vi.fn(async (cb) => {
          const tx = {
            balanceSnapshot: {
              findFirst: vi.fn().mockImplementation(() => {
                const sorted = [...snapshotsStore].sort((a, b) => b.version - a.version);
                return sorted[0] || null;
              }),
              updateMany: vi.fn().mockImplementation(({ where }) => {
                snapshotsStore.forEach((s) => {
                  if (s.groupId === where.groupId && s.isCurrent === where.isCurrent) {
                    s.isCurrent = false;
                  }
                });
                return { count: snapshotsStore.length };
              }),
              create: vi.fn().mockImplementation(({ data }) => {
                const newSnap = {
                  id: `snap-${data.version}`,
                  ...data,
                  createdAt: new Date(),
                };
                snapshotsStore.push(newSnap);
                return newSnap;
              }),
            },
          };
          return cb(tx);
        }),
        expense: { findMany: vi.fn().mockResolvedValue([]) },
        settlement: { findMany: vi.fn().mockResolvedValue([]) },
        groupMembership: { findMany: vi.fn().mockResolvedValue([]) },
      };
      balanceService = new BalanceEngineService(mockPrisma as any);
    });

    it('shouldCreateNewSnapshotVersion', async () => {
      // 1. Initial rebuild (Version 1)
      const snap1 = await balanceService.rebuildSnapshot('g1');
      expect(snap1.version).toBe(1);
      expect(snap1.isCurrent).toBe(true);
      expect(snapshotsStore.length).toBe(1);

      // 2. Next rebuild (Version 2)
      const snap2 = await balanceService.rebuildSnapshot('g1');
      expect(snap2.version).toBe(2);
      expect(snap2.isCurrent).toBe(true);
      expect(snapshotsStore.length).toBe(2);
    });

    it('shouldPreserveHistoricalSnapshots', async () => {
      await balanceService.rebuildSnapshot('g1'); // v1
      await balanceService.rebuildSnapshot('g1'); // v2
      await balanceService.rebuildSnapshot('g1'); // v3

      expect(snapshotsStore.length).toBe(3);
      expect(snapshotsStore.find((s) => s.version === 1)).toBeDefined();
      expect(snapshotsStore.find((s) => s.version === 2)).toBeDefined();
      expect(snapshotsStore.find((s) => s.version === 3)).toBeDefined();
    });

    it('shouldMaintainSingleCurrentSnapshot', async () => {
      await balanceService.rebuildSnapshot('g1'); // v1
      await balanceService.rebuildSnapshot('g1'); // v2
      await balanceService.rebuildSnapshot('g1'); // v3

      const currentSnaps = snapshotsStore.filter((s) => s.isCurrent === true);
      expect(currentSnaps.length).toBe(1);
      expect(currentSnaps[0].version).toBe(3);
      expect(snapshotsStore.find((s) => s.version === 1).isCurrent).toBe(false);
      expect(snapshotsStore.find((s) => s.version === 2).isCurrent).toBe(false);
    });
  });

  describe('Debt Simplification Tests', () => {
    let simplifier: DebtSimplificationService;

    beforeEach(() => {
      simplifier = new DebtSimplificationService();
    });

    it('shouldSimplifyDebtsGreedily', () => {
      const userBalances = {
        'u-aisha': 2000,
        'u-rohan': -1000,
        'u-priya': -1000,
      };

      const plan = simplifier.calculateRepaymentPlan(userBalances);
      
      expect(plan.length).toBe(2);
      
      const p1 = plan.find((p) => p.debtorId === 'u-rohan');
      expect(p1).toBeDefined();
      expect(p1!.creditorId).toBe('u-aisha');
      expect(p1!.amount).toBe(1000);

      const p2 = plan.find((p) => p.debtorId === 'u-priya');
      expect(p2).toBeDefined();
      expect(p2!.creditorId).toBe('u-aisha');
      expect(p2!.amount).toBe(1000);
    });

    it('shouldResolveCircleDebts', () => {
      // A owes B 100, B owes C 100, C owes A 100
      // Net balances are all 0. Simplification should return empty repayment recommendations.
      const userBalances = {
        'u-a': 0,
        'u-b': 0,
        'u-c': 0,
      };

      const plan = simplifier.calculateRepaymentPlan(userBalances);
      expect(plan.length).toBe(0);
    });
  });

  describe('Explainability Timeline Tests', () => {
    let mockPrisma: any;
    let explainService: BalanceExplanationService;

    beforeEach(() => {
      mockPrisma = {
        expense: { findMany: vi.fn() },
        settlement: { findMany: vi.fn() },
        user: { findUnique: vi.fn() },
      };
      explainService = new BalanceExplanationService(mockPrisma as any);
    });

    it('shouldExplainChronologicalTimeline', async () => {
      // Aisha paid 3000 on Feb 15 (Rohan share 1000)
      // Rohan settled 500 to Aisha on Feb 20
      mockPrisma.expense.findMany.mockResolvedValue([
        {
          id: 'e1',
          description: 'Rent',
          paidById: 'u-aisha',
          date: new Date('2026-02-15T00:00:00Z'),
          originalAmount: new Decimal(3000),
          originalCurrency: 'INR',
          exchangeRate: new Decimal(1.0),
          baseCurrencyAmount: new Decimal(3000),
          participants: [
            { userId: 'u-rohan', calculatedAmount: new Decimal(1000) },
          ],
        },
      ]);
      mockPrisma.settlement.findMany.mockResolvedValue([
        {
          id: 's1',
          senderId: 'u-rohan',
          receiverId: 'u-aisha',
          date: new Date('2026-02-20T00:00:00Z'),
          amount: new Decimal(500),
          currency: 'INR',
          exchangeRate: new Decimal(1.0),
          baseCurrencyAmount: new Decimal(500),
          notes: 'Half Repay',
        },
      ]);

      const explanation = await explainService.getBalanceExplanation('g1', 'u-rohan');

      expect(explanation.length).toBe(2);

      // First step: Share Owed
      expect(explanation[0].type).toBe('EXPENSE_SHARE');
      expect(explanation[0].impact).toBe(-1000);
      expect(explanation[0].runningBalance).toBe(-1000);

      // Second step: Settlement Sent
      expect(explanation[1].type).toBe('SETTLEMENT_SENT');
      expect(explanation[1].impact).toBe(500);
      expect(explanation[1].runningBalance).toBe(-500);
    });
  });
});
