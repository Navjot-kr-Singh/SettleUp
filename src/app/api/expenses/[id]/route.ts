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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const expense = await expenseService.getExpenseDetails(id);
    return NextResponse.json(expense);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = ExpenseSchema.parse(body);

    const expense = await expenseService.updateExpense(id, {
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
    return NextResponse.json(expense);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await expenseService.deleteExpense(id, (session.user as any).id);
    return NextResponse.json({ success: true, message: 'Expense soft-deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
