import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BalanceEngineService } from '@/services/BalanceEngineService';
import { DebtSimplificationService } from '@/services/DebtSimplificationService';
import { z } from 'zod';

const balanceEngine = new BalanceEngineService(prisma);
const debtSimplifier = new DebtSimplificationService();

const ParamSchema = z.object({
  groupId: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { groupId } = ParamSchema.parse(rawParams);

    // 1. Single Source of Truth: retrieve balances calculated exclusively via BalanceEngineService
    const balances = await balanceEngine.getGroupBalances(groupId);

    // 2. Map list to a record for the simplification engine
    const balanceMap: Record<string, number> = {};
    for (const b of balances) {
      balanceMap[b.userId] = b.netBalance;
    }

    // 3. Calculate minimum transaction repayment recommendations
    const repaymentPlan = debtSimplifier.calculateRepaymentPlan(balanceMap);

    return NextResponse.json(repaymentPlan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
