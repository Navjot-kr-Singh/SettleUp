import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { SplitType } from '@prisma/client';
import { SplitCalculationService } from '../../services/SplitCalculationService';
import { ExchangeRateService } from '../../services/ExchangeRateService';
import { CurrencyService } from '../../services/CurrencyService';
import { ExpenseService } from '../../services/ExpenseService';
import { SettlementService } from '../../services/SettlementService';
import { MembershipService } from '../../services/membership';
import { ExpenseRepository } from '../../repositories/expense.repo';
import { SettlementRepository } from '../../repositories/settlement.repo';
import { prisma } from '../../lib/prisma';

// Mock the prisma client singleton
vi.mock('../../lib/prisma', () => {
  return {
    prisma: {
      currency: { upsert: vi.fn(), findMany: vi.fn() },
      exchangeRate: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
      user: { findUnique: vi.fn() },
      groupMembership: { findUnique: vi.fn() },
      expense: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      expenseParticipant: { deleteMany: vi.fn() },
      settlement: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      $transaction: vi.fn((cb) => cb(prisma)),
    },
  };
});

describe('Financial Domain Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SplitCalculationService (Strategy Pattern)', () => {
    const calcService = new SplitCalculationService();

    it('should split EQUAL correctly without errors', () => {
      const parts = [
        { userId: 'u-1' },
        { userId: 'u-2' },
        { userId: 'u-3' },
      ];
      const result = calcService.calculateSplits(100, SplitType.EQUAL, parts);
      expect(result.length).toBe(3);
      expect(result[0].calculatedAmount.toNumber()).toBe(33.34);
      expect(result[1].calculatedAmount.toNumber()).toBe(33.33);
      expect(result[2].calculatedAmount.toNumber()).toBe(33.33);
    });

    it('should split EXACT correctly matching total', () => {
      const parts = [
        { userId: 'u-1', shareValue: new Decimal(40) },
        { userId: 'u-2', shareValue: new Decimal(60) },
      ];
      const result = calcService.calculateSplits(100, SplitType.EXACT, parts);
      expect(result[0].calculatedAmount.toNumber()).toBe(40);
      expect(result[1].calculatedAmount.toNumber()).toBe(60);
    });

    it('should throw error on EXACT split if sum does not equal total', () => {
      const parts = [
        { userId: 'u-1', shareValue: new Decimal(40) },
        { userId: 'u-2', shareValue: new Decimal(50) },
      ];
      expect(() => {
        calcService.calculateSplits(100, SplitType.EXACT, parts);
      }).toThrow('The sum of exact split values (90) must equal the total expense amount (100).');
    });

    it('should split PERCENTAGE correctly matching 100%', () => {
      const parts = [
        { userId: 'u-1', shareValue: new Decimal(30) },
        { userId: 'u-2', shareValue: new Decimal(70) },
      ];
      const result = calcService.calculateSplits(250, SplitType.PERCENTAGE, parts);
      expect(result[0].calculatedAmount.toNumber()).toBe(75);
      expect(result[1].calculatedAmount.toNumber()).toBe(175);
    });

    it('should throw error on PERCENTAGE split if sum is not 100%', () => {
      const parts = [
        { userId: 'u-1', shareValue: new Decimal(30) },
        { userId: 'u-2', shareValue: new Decimal(30) },
      ];
      expect(() => {
        calcService.calculateSplits(100, SplitType.PERCENTAGE, parts);
      }).toThrow('Percentages must sum to exactly 100%. Provided: 60%');
    });

    it('should split SHARES correctly based on ratios', () => {
      const parts = [
        { userId: 'u-1', shareValue: new Decimal(1) },
        { userId: 'u-2', shareValue: new Decimal(2) },
      ];
      const result = calcService.calculateSplits(300, SplitType.SHARES, parts);
      expect(result[0].calculatedAmount.toNumber()).toBe(100);
      expect(result[1].calculatedAmount.toNumber()).toBe(200);
    });
  });

  describe('ExchangeRateService & Currencies', () => {
    const rateService = new ExchangeRateService(prisma);

    it('should return default 1.0 rate when from and to currencies match', async () => {
      const rate = await rateService.getRateForDate('INR', 'INR', new Date());
      expect(rate.toNumber()).toBe(1.0);
    });

    it('should look up closest historical rate effective on or before date', async () => {
      const date = new Date('2026-03-10T00:00:00Z');
      
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        fromCurrency: 'USD',
        toCurrency: 'INR',
        rate: new Decimal(83.50),
        effectiveDate: new Date('2026-02-01T00:00:00Z'),
        createdAt: new Date(),
      });

      const rate = await rateService.getRateForDate('USD', 'INR', date);
      expect(rate.toNumber()).toBe(83.50);
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fromCurrency: 'USD',
            toCurrency: 'INR',
            effectiveDate: { lte: date },
          },
        })
      );
    });

    it('should convert amount to base currency (INR)', async () => {
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValueOnce({
        id: 'rate-1',
        fromCurrency: 'USD',
        toCurrency: 'INR',
        rate: new Decimal(83.50),
        effectiveDate: new Date('2026-02-01'),
        createdAt: new Date(),
      });

      const result = await rateService.convertToBase(10, 'USD', new Date());
      expect(result.convertedAmount.toNumber()).toBe(835.00);
      expect(result.exchangeRate.toNumber()).toBe(83.50);
    });
  });

  describe('Expense Lifecycle Management', () => {
    let mockExpenseRepo: any;
    let mockSplitCalc: any;
    let mockExchangeRate: any;
    let mockMembership: any;
    let mockAudit: any;
    let service: ExpenseService;

    beforeEach(() => {
      mockExpenseRepo = {
        createExpense: vi.fn(),
        findExpenseById: vi.fn(),
        listExpenses: vi.fn(),
        softDeleteExpense: vi.fn(),
        updateExpense: vi.fn(),
      };
      mockSplitCalc = new SplitCalculationService();
      mockExchangeRate = {
        convertToBase: vi.fn().mockResolvedValue({
          convertedAmount: new Decimal(8350),
          exchangeRate: new Decimal(83.5),
        }),
      };
      mockMembership = {
        isUserActiveOnDate: vi.fn().mockResolvedValue(true),
      };
      mockAudit = {
        logEvent: vi.fn().mockResolvedValue({}),
      };

      const mockBalanceEngine = {
        rebuildSnapshot: vi.fn().mockResolvedValue({}),
      };

      service = new ExpenseService(
        mockExpenseRepo as unknown as ExpenseRepository,
        mockSplitCalc,
        mockExchangeRate as unknown as ExchangeRateService,
        mockMembership as unknown as MembershipService,
        mockAudit,
        mockBalanceEngine as any
      );
    });

    it('should create an expense and calculate splits', async () => {
      const expenseInput = {
        groupId: 'g-1',
        paidById: 'u-1',
        description: 'Goa Villa',
        originalAmount: 100,
        originalCurrency: 'USD',
        date: new Date('2026-03-09'),
        splitType: SplitType.EQUAL,
        participants: [
          { userId: 'u-1' },
          { userId: 'u-2' },
        ],
      };

      mockExpenseRepo.createExpense.mockResolvedValueOnce({
        id: 'exp-1',
        description: 'Goa Villa',
      });

      const expense = await service.createExpense(expenseInput, 'u-1');

      expect(expense).toBeDefined();
      expect(mockMembership.isUserActiveOnDate).toHaveBeenCalledTimes(3);
      expect(mockExchangeRate.convertToBase).toHaveBeenCalledWith(100, 'USD', expenseInput.date);
      expect(mockExpenseRepo.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'g-1',
          paidById: 'u-1',
          description: 'Goa Villa',
          baseCurrencyAmount: new Decimal(8350),
        })
      );
      expect(mockAudit.logEvent).toHaveBeenCalled();
    });

    it('should soft delete expense', async () => {
      mockExpenseRepo.findExpenseById.mockResolvedValueOnce({ id: 'exp-1' });
      mockExpenseRepo.softDeleteExpense.mockResolvedValueOnce({ id: 'exp-1', deletedAt: new Date() });

      await service.deleteExpense('exp-1', 'u-1');
      expect(mockExpenseRepo.softDeleteExpense).toHaveBeenCalledWith('exp-1');
      expect(mockAudit.logEvent).toHaveBeenCalled();
    });

    it('should fail expense creation if payer is inactive on date', async () => {
      mockMembership.isUserActiveOnDate.mockResolvedValueOnce(false); // payer is inactive

      const expenseInput = {
        groupId: 'g-1',
        paidById: 'u-1',
        description: 'Rent',
        originalAmount: 100,
        originalCurrency: 'INR',
        date: new Date('2026-03-09'),
        splitType: SplitType.EQUAL,
        participants: [{ userId: 'u-1' }],
      };

      await expect(service.createExpense(expenseInput, 'u-1')).rejects.toThrow(
        'Payer is not an active group member on transaction date'
      );
    });

    it('should list expenses for a group', async () => {
      mockExpenseRepo.listExpenses.mockResolvedValueOnce([{ id: 'exp-1', description: 'Goa Villa' }]);
      const list = await service.listExpenses('g-1');
      expect(list.length).toBe(1);
      expect(list[0].description).toBe('Goa Villa');
      expect(mockExpenseRepo.listExpenses).toHaveBeenCalledWith('g-1');
    });

    it('should update an expense successfully', async () => {
      const expenseInput = {
        description: 'Updated Goa Villa',
        originalAmount: 120,
        originalCurrency: 'USD',
        date: new Date('2026-03-09'),
        splitType: SplitType.EQUAL,
        participants: [
          { userId: 'u-1' },
          { userId: 'u-2' },
        ],
      };

      mockExpenseRepo.findExpenseById.mockResolvedValueOnce({ id: 'exp-1', groupId: 'g-1', paidById: 'u-1' });
      mockExpenseRepo.updateExpense.mockResolvedValueOnce({ id: 'exp-1', description: 'Updated Goa Villa' });

      const expense = await service.updateExpense('exp-1', expenseInput, 'u-1');
      expect(expense).toBeDefined();
      expect(mockExpenseRepo.updateExpense).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({
          description: 'Updated Goa Villa',
        })
      );
      expect(mockAudit.logEvent).toHaveBeenCalled();
    });
  });

  describe('Settlement System Management', () => {
    let mockSettlementRepo: any;
    let mockExchangeRate: any;
    let mockMembership: any;
    let mockAudit: any;
    let service: SettlementService;

    beforeEach(() => {
      mockSettlementRepo = {
        createSettlement: vi.fn(),
        findSettlementById: vi.fn(),
        listSettlements: vi.fn(),
        updateSettlement: vi.fn(),
      };
      mockExchangeRate = {
        convertToBase: vi.fn().mockResolvedValue({
          convertedAmount: new Decimal(5000),
          exchangeRate: new Decimal(1.0),
        }),
      };
      mockMembership = {
        isUserActiveOnDate: vi.fn().mockResolvedValue(true),
      };
      mockAudit = {
        logEvent: vi.fn().mockResolvedValue({}),
      };

      const mockBalanceEngine = {
        rebuildSnapshot: vi.fn().mockResolvedValue({}),
      };

      service = new SettlementService(
        mockSettlementRepo as unknown as SettlementRepository,
        mockExchangeRate as unknown as ExchangeRateService,
        mockMembership as unknown as MembershipService,
        mockAudit,
        mockBalanceEngine as any
      );
    });

    it('should create settlement repayment successfully', async () => {
      const settlementInput = {
        groupId: 'g-1',
        senderId: 'u-1',
        receiverId: 'u-2',
        amount: 5000,
        currency: 'INR',
        date: new Date('2026-02-25'),
        notes: 'Repay',
      };

      mockSettlementRepo.createSettlement.mockResolvedValueOnce({ id: 'settle-1' });

      const result = await service.createSettlement(settlementInput, 'u-1');
      expect(result).toBeDefined();
      expect(mockSettlementRepo.createSettlement).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 'u-1',
          receiverId: 'u-2',
          baseCurrencyAmount: new Decimal(5000),
        })
      );
      expect(mockAudit.logEvent).toHaveBeenCalled();
    });

    it('should fail settlement if sender and receiver are the same user', async () => {
      const settlementInput = {
        groupId: 'g-1',
        senderId: 'u-1',
        receiverId: 'u-1',
        amount: 500,
        currency: 'INR',
        date: new Date(),
      };

      await expect(service.createSettlement(settlementInput, 'u-1')).rejects.toThrow(
        'Sender and Receiver of a settlement cannot be the same user.'
      );
    });

    it('should fail settlement if sender is not active in group on date', async () => {
      mockMembership.isUserActiveOnDate.mockResolvedValueOnce(false); // sender is inactive

      const settlementInput = {
        groupId: 'g-1',
        senderId: 'u-1',
        receiverId: 'u-2',
        amount: 500,
        currency: 'INR',
        date: new Date(),
      };

      await expect(service.createSettlement(settlementInput, 'u-1')).rejects.toThrow(
        'Sender is not active in the group on date'
      );
    });

    it('should list settlements for a group', async () => {
      mockSettlementRepo.listSettlements.mockResolvedValueOnce([{ id: 'settle-1', amount: new Decimal(5000) }]);
      const list = await service.listSettlements('g-1');
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('settle-1');
      expect(mockSettlementRepo.listSettlements).toHaveBeenCalledWith('g-1');
    });

    it('should update a settlement successfully', async () => {
      const settlementInput = {
        amount: 6000,
        currency: 'INR',
        date: new Date('2026-02-25'),
        notes: 'Updated repayment',
      };

      mockSettlementRepo.findSettlementById.mockResolvedValueOnce({
        id: 'settle-1',
        groupId: 'g-1',
        senderId: 'u-1',
        receiverId: 'u-2',
      });
      mockSettlementRepo.updateSettlement.mockResolvedValueOnce({ id: 'settle-1', amount: new Decimal(6000) });

      const result = await service.updateSettlement('settle-1', settlementInput, 'u-1');
      expect(result).toBeDefined();
      expect(mockSettlementRepo.updateSettlement).toHaveBeenCalledWith(
        'settle-1',
        expect.objectContaining({
          amount: new Decimal(6000),
          notes: 'Updated repayment',
        })
      );
      expect(mockAudit.logEvent).toHaveBeenCalled();
    });
  });

  describe('CurrencyService', () => {
    it('should upsert and list currencies', async () => {
      const currencyService = new CurrencyService(prisma);

      vi.mocked(prisma.currency.upsert).mockResolvedValueOnce({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const added = await currencyService.addCurrency('usd', 'US Dollar', '$');
      expect(added.code).toBe('USD');
      expect(prisma.currency.upsert).toHaveBeenCalledWith({
        where: { code: 'USD' },
        update: { name: 'US Dollar', symbol: '$' },
        create: { code: 'USD', name: 'US Dollar', symbol: '$' },
      });

      vi.mocked(prisma.currency.findMany).mockResolvedValueOnce([
        { code: 'USD', name: 'US Dollar', symbol: '$' },
      ]);
      const list = await currencyService.listCurrencies();
      expect(list.length).toBe(1);
      expect(list[0].code).toBe('USD');
    });
  });
});
