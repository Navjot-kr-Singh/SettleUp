import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ImportDryRunService } from '@/services/ImportDryRunService';
import { z } from 'zod';

const ParamSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { id } = ParamSchema.parse(rawParams);

    const dryRunService = new ImportDryRunService(prisma);
    const report = await dryRunService.reconstructDryRunReport(id);

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
