import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BalanceExplanationService } from '@/services/BalanceExplanationService';
import { z } from 'zod';

const explanationService = new BalanceExplanationService(prisma);

const ParamSchema = z.object({
  userId: z.string().uuid(),
});

const QuerySchema = z.object({
  groupId: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

  try {
    const rawParams = await params;
    const { userId } = ParamSchema.parse(rawParams);
    
    const { groupId: validatedGroupId } = QuerySchema.parse({ groupId });

    const steps = await explanationService.getBalanceExplanation(validatedGroupId, userId);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const lastStep = steps[steps.length - 1];
    const total = lastStep ? lastStep.runningBalance : 0;

    return NextResponse.json({
      userId,
      userName: user?.name || 'Unknown',
      netBalance: total,
      steps,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
