import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ImportDryRunService } from '@/services/ImportDryRunService';
import { z } from 'zod';

const RequestSchema = z.object({
  groupId: z.string().uuid(),
  fileName: z.string().min(1),
  csvContent: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { groupId, fileName, csvContent } = RequestSchema.parse(body);

    const dryRunService = new ImportDryRunService(prisma);
    const report = await dryRunService.importDryRun(groupId, fileName, csvContent, (session.user as any).id);

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[API_DRY_RUN_ERROR] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
