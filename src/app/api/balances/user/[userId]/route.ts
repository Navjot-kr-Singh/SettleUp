import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BalanceEngineService } from '@/services/BalanceEngineService';
import { z } from 'zod';

const balanceEngine = new BalanceEngineService(prisma);

const ParamSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { userId } = ParamSchema.parse(rawParams);

    const userBalances = await balanceEngine.getUserBalancesAcrossGroups(userId);
    return NextResponse.json(userBalances);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
