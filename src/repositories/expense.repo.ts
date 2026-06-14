import { PrismaClient, SplitType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class ExpenseRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createExpense(data: {
    groupId: string;
    paidById: string;
    description: string;
    originalAmount: Decimal;
    originalCurrency: string;
    exchangeRate: Decimal;
    baseCurrencyAmount: Decimal;
    date: Date;
    splitType: SplitType;
    notes?: string;
    participants: { userId: string; shareValue?: Decimal; calculatedAmount: Decimal }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId: data.groupId,
          paidById: data.paidById,
          description: data.description,
          originalAmount: data.originalAmount,
          originalCurrency: data.originalCurrency,
          exchangeRate: data.exchangeRate,
          baseCurrencyAmount: data.baseCurrencyAmount,
          date: data.date,
          splitType: data.splitType,
          notes: data.notes,
          participants: {
            create: data.participants.map((p) => ({
              userId: p.userId,
              shareValue: p.shareValue,
              calculatedAmount: p.calculatedAmount,
            })),
          },
        },
        include: {
          participants: {
            include: { user: true },
          },
          paidBy: true,
        },
      });
      return expense;
    });
  }

  async findExpenseById(id: string, includeDeleted = false) {
    return this.prisma.expense.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        participants: {
          include: { user: true },
        },
        paidBy: true,
      },
    });
  }

  async listExpenses(groupId: string, includeDeleted = false) {
    return this.prisma.expense.findMany({
      where: {
        groupId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { date: 'desc' },
      include: {
        participants: {
          include: { user: true },
        },
        paidBy: true,
      },
    });
  }

  async softDeleteExpense(id: string) {
    return this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateExpense(
    id: string,
    data: {
      description: string;
      originalAmount: Decimal;
      originalCurrency: string;
      exchangeRate: Decimal;
      baseCurrencyAmount: Decimal;
      date: Date;
      splitType: SplitType;
      notes?: string;
      participants: { userId: string; shareValue?: Decimal; calculatedAmount: Decimal }[];
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete all existing splits
      await tx.expenseParticipant.deleteMany({
        where: { expenseId: id },
      });

      // 2. Update Expense header and insert new splits
      return tx.expense.update({
        where: { id },
        data: {
          description: data.description,
          originalAmount: data.originalAmount,
          originalCurrency: data.originalCurrency,
          exchangeRate: data.exchangeRate,
          baseCurrencyAmount: data.baseCurrencyAmount,
          date: data.date,
          splitType: data.splitType,
          notes: data.notes,
          participants: {
            create: data.participants.map((p) => ({
              userId: p.userId,
              shareValue: p.shareValue,
              calculatedAmount: p.calculatedAmount,
            })),
          },
        },
        include: {
          participants: {
            include: { user: true },
          },
          paidBy: true,
        },
      });
    });
  }
}
