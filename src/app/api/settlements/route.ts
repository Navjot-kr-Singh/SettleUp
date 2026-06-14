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
    const settlements = await settlementService.listSettlements(groupId);
    return NextResponse.json(settlements);
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
    const validated = SettlementSchema.parse(body);

    const settlement = await settlementService.createSettlement({
      ...validated,
      notes: validated.notes ?? undefined,
    }, (session.user as any).id);
    return NextResponse.json(settlement, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 400 });
  }
}
