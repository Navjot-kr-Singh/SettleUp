import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CommitImportService } from '@/services/CommitImportService';
import { z } from 'zod';

const ParamSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { sessionId } = ParamSchema.parse(rawParams);

    const commitService = new CommitImportService(prisma);
    const status = await commitService.getCommitStatus(sessionId);

    return NextResponse.json(status, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
