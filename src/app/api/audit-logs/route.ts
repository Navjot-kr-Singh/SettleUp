import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditActionType } from '@prisma/client';

const auditRepo = new AuditLogRepository(prisma);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || undefined;
  const entityId = searchParams.get('entityId') || undefined;
  const entityType = searchParams.get('entityType') || undefined;
  const correlationId = searchParams.get('correlationId') || undefined;
  const search = searchParams.get('search') || undefined;

  const pageStr = searchParams.get('page');
  const limitStr = searchParams.get('limit');
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  const actionsStr = searchParams.get('actions');
  const actions = actionsStr 
    ? (actionsStr.split(',').filter(Boolean) as AuditActionType[])
    : undefined;

  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  try {
    const result = await auditRepo.list({
      userId,
      entityId,
      entityType,
      actions,
      startDate,
      endDate,
      correlationId,
      search,
      page,
      limit,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
