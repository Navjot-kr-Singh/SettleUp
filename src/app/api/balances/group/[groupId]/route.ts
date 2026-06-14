import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BalanceEngineService } from '@/services/BalanceEngineService';
import { z } from 'zod';

const balanceEngine = new BalanceEngineService(prisma);

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

    const balances = await balanceEngine.getGroupBalances(groupId);
    return NextResponse.json(balances);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
