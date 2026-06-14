import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CommitImportService } from '@/services/CommitImportService';
import { z } from 'zod';

const ParamSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(
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

    const actorId = (authSession.user as any).id;
    if (!actorId) {
      return NextResponse.json({ error: 'Actor ID missing from session' }, { status: 401 });
    }

    const commitService = new CommitImportService(prisma);
    const result = await commitService.commitSession(sessionId, actorId);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const statusCode = error.message?.startsWith('COMMIT_REJECTED') ? 422 : 500;
    return NextResponse.json({ error: error.message }, { status: statusCode });
  }
}
