import { ExpenseRepository } from '@/repositories/expense.repo';
import { SplitCalculationService } from './SplitCalculationService';
import { ExchangeRateService } from './ExchangeRateService';
import { MembershipService } from './membership';
import { AuditService } from './AuditService';
import { BalanceEngineService } from './BalanceEngineService';
import { SplitType, AuditActionType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class ExpenseService {
  private repo: ExpenseRepository;
  private splitCalc: SplitCalculationService;
  private exchangeRate: ExchangeRateService;
  private membership: MembershipService;
  private audit: AuditService;
  private balanceEngine: BalanceEngineService;

  constructor(
    repo: ExpenseRepository,
    splitCalc: SplitCalculationService,
    exchangeRate: ExchangeRateService,
    membership: MembershipService,
    audit: AuditService,
    balanceEngine: BalanceEngineService
  ) {
    this.repo = repo;
    this.splitCalc = splitCalc;
    this.exchangeRate = exchangeRate;
    this.membership = membership;
    this.audit = audit;
    this.balanceEngine = balanceEngine;
  }

  async createExpense(
    data: {
      groupId: string;
      paidById: string;
      description: string;
      originalAmount: number | string;
      originalCurrency: string;
      date: Date;
      splitType: SplitType;
      notes?: string;
      participants: { userId: string; shareValue?: number }[];
    },
    actorId: string,
    correlationId?: string
  ) {
    // 1. Validate membership boundaries dynamically from the database
    const isActivePayer = await this.membership.isUserActiveOnDate(data.groupId, data.paidById, data.date);
    if (!isActivePayer) {
      throw new Error(`Payer is not an active group member on transaction date ${data.date.toISOString()}`);
    }

    for (const p of data.participants) {
      const isActivePart = await this.membership.isUserActiveOnDate(data.groupId, p.userId, data.date);
      if (!isActivePart) {
        throw new Error(
          `Participant ${p.userId} is not an active group member on transaction date ${data.date.toISOString()}`
        );
      }
    }

    // 2. Perform multi-currency conversion to base INR
    const { convertedAmount, exchangeRate } = await this.exchangeRate.convertToBase(
      data.originalAmount,
      data.originalCurrency,
      data.date
    );

    // 3. Perform strategy-based split calculation in base currency (INR)
    const strategyParticipants = data.participants.map((p) => ({
      userId: p.userId,
      shareValue: p.shareValue !== undefined ? new Decimal(p.shareValue) : undefined,
    }));

    const calculatedSplits = this.splitCalc.calculateSplits(
      convertedAmount,
      data.splitType,
      strategyParticipants
    );

    // 4. Save to database
    const expense = await this.repo.createExpense({
      groupId: data.groupId,
      paidById: data.paidById,
      description: data.description,
      originalAmount: new Decimal(data.originalAmount),
      originalCurrency: data.originalCurrency,
      exchangeRate,
      baseCurrencyAmount: convertedAmount,
      date: data.date,
      splitType: data.splitType,
      notes: data.notes,
      participants: calculatedSplits.map((s) => {
        const originalPart = data.participants.find((p) => p.userId === s.userId);
        return {
          userId: s.userId,
          shareValue: originalPart?.shareValue !== undefined ? new Decimal(originalPart.shareValue) : undefined,
          calculatedAmount: s.calculatedAmount,
        };
      }),
    });

    // 5. Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(data.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on createExpense:', err);
    }

    // 6. Fire-and-forget Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.CREATE_EXPENSE,
      entityType: 'EXPENSE',
      entityId: expense.id,
      afterState: expense,
      correlationId,
    });

    return expense;
  }

  async getExpenseDetails(id: string) {
    const expense = await this.repo.findExpenseById(id);
    if (!expense) {
      throw new Error('Expense not found');
    }
    return expense;
  }

  async listExpenses(groupId: string) {
    return this.repo.listExpenses(groupId);
  }

  async deleteExpense(id: string, actorId: string, correlationId?: string) {
    const beforeState = await this.repo.findExpenseById(id);
    if (!beforeState) {
      throw new Error('Expense not found');
    }
    const expense = await this.repo.softDeleteExpense(id);

    // Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(beforeState.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on deleteExpense:', err);
    }

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.DELETE_EXPENSE,
      entityType: 'EXPENSE',
      entityId: id,
      beforeState,
      afterState: expense,
      correlationId,
    });

    return expense;
  }

  async updateExpense(
    id: string,
    data: {
      description: string;
      originalAmount: number | string;
      originalCurrency: string;
      date: Date;
      splitType: SplitType;
      notes?: string;
      participants: { userId: string; shareValue?: number }[];
    },
    actorId: string,
    correlationId?: string
  ) {
    const beforeState = await this.repo.findExpenseById(id);
    if (!beforeState) {
      throw new Error('Expense not found');
    }

    // Validate membership boundaries
    const isActivePayer = await this.membership.isUserActiveOnDate(beforeState.groupId, beforeState.paidById, data.date);
    if (!isActivePayer) {
      throw new Error(`Payer is not an active group member on transaction date ${data.date.toISOString()}`);
    }

    for (const p of data.participants) {
      const isActivePart = await this.membership.isUserActiveOnDate(beforeState.groupId, p.userId, data.date);
      if (!isActivePart) {
        throw new Error(
          `Participant ${p.userId} is not an active group member on transaction date ${data.date.toISOString()}`
        );
      }
    }

    // Perform multi-currency conversion to base INR
    const { convertedAmount, exchangeRate } = await this.exchangeRate.convertToBase(
      data.originalAmount,
      data.originalCurrency,
      data.date
    );

    const strategyParticipants = data.participants.map((p) => ({
      userId: p.userId,
      shareValue: p.shareValue !== undefined ? new Decimal(p.shareValue) : undefined,
    }));

    const calculatedSplits = this.splitCalc.calculateSplits(
      convertedAmount,
      data.splitType,
      strategyParticipants
    );

    const updated = await this.repo.updateExpense(id, {
      description: data.description,
      originalAmount: new Decimal(data.originalAmount),
      originalCurrency: data.originalCurrency,
      exchangeRate,
      baseCurrencyAmount: convertedAmount,
      date: data.date,
      splitType: data.splitType,
      notes: data.notes,
      participants: calculatedSplits.map((s) => {
        const originalPart = data.participants.find((p) => p.userId === s.userId);
        return {
          userId: s.userId,
          shareValue: originalPart?.shareValue !== undefined ? new Decimal(originalPart.shareValue) : undefined,
          calculatedAmount: s.calculatedAmount,
        };
      }),
    });

    // Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(beforeState.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on updateExpense:', err);
    }

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.UPDATE_EXPENSE,
      entityType: 'EXPENSE',
      entityId: id,
      beforeState,
      afterState: updated,
      correlationId,
    });

    return updated;
  }
}
