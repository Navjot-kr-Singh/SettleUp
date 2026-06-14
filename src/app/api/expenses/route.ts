import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExpenseRepository } from '@/repositories/expense.repo';
import { ExpenseService } from '@/services/ExpenseService';
import { SplitCalculationService } from '@/services/SplitCalculationService';
import { ExchangeRateService } from '@/services/ExchangeRateService';
import { MembershipService } from '@/services/membership';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditService } from '@/services/AuditService';
import { BalanceEngineService } from '@/services/BalanceEngineService';
import { ExpenseSchema } from '@/types';

const auditRepo = new AuditLogRepository(prisma);
const auditService = new AuditService(auditRepo);

const expenseRepo = new ExpenseRepository(prisma);
const splitCalc = new SplitCalculationService();
const exchangeRate = new ExchangeRateService(prisma);
const membership = new MembershipService(prisma);
const balanceEngine = new BalanceEngineService(prisma);
const expenseService = new ExpenseService(expenseRepo, splitCalc, exchangeRate, membership, auditService, balanceEngine);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  if (!groupId) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
  }

  try {
    const expenses = await expenseService.listExpenses(groupId);
    return NextResponse.json(expenses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = ExpenseSchema.parse(body);
    const expense = await expenseService.createExpense({
      groupId: validated.groupId,
      paidById: validated.paidById,
      description: validated.description,
      originalAmount: validated.originalAmount,
      originalCurrency: validated.originalCurrency,
      date: validated.date,
      splitType: validated.splitType,
      notes: validated.notes ?? undefined,
      participants: validated.participants.map(p => ({
        userId: p.userId,
        shareValue: p.shareValue ?? undefined,
      })),
    }, (session.user as any).id);
    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 400 });
  }
}
