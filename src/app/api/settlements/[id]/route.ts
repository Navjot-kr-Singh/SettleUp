import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SettlementRepository } from '@/repositories/settlement.repo';
import { SettlementService } from '@/services/SettlementService';
import { ExchangeRateService } from '@/services/ExchangeRateService';
import { MembershipService } from '@/services/membership';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditService } from '@/services/AuditService';
import { BalanceEngineService } from '@/services/BalanceEngineService';
import { SettlementSchema } from '@/types';

const auditRepo = new AuditLogRepository(prisma);
const auditService = new AuditService(auditRepo);

const settlementRepo = new SettlementRepository(prisma);
const exchangeRate = new ExchangeRateService(prisma);
const membership = new MembershipService(prisma);
const balanceEngine = new BalanceEngineService(prisma);
const settlementService = new SettlementService(settlementRepo, exchangeRate, membership, auditService, balanceEngine);

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
    const settlement = await settlementService.getSettlementDetails(id);
    return NextResponse.json(settlement);
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
    const validated = SettlementSchema.parse(body);

    const settlement = await settlementService.updateSettlement(id, {
      amount: validated.amount,
      currency: validated.currency,
      date: validated.date,
      notes: validated.notes ?? undefined,
    }, (session.user as any).id);
    return NextResponse.json(settlement);
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
    await settlementService.deleteSettlement(id, (session.user as any).id);
    return NextResponse.json({ success: true, message: 'Settlement deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
