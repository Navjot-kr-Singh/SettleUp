import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogRepository } from '@/repositories/audit.repo';

const auditRepo = new AuditLogRepository(prisma);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entityId } = await params;

  try {
    const result = await auditRepo.list({ entityId });
    return NextResponse.json(result.logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
