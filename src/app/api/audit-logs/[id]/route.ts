import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogRepository } from '@/repositories/audit.repo';

const auditRepo = new AuditLogRepository(prisma);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const log = await auditRepo.findById(id);
    if (!log) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
    }
    return NextResponse.json(log);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
