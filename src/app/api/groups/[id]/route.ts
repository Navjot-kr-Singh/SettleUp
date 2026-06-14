import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GroupRepository } from '@/repositories/group.repo';
import { GroupService } from '@/services/group';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditService } from '@/services/AuditService';
import { z } from 'zod';

const auditRepo = new AuditLogRepository(prisma);
const auditService = new AuditService(auditRepo);
const groupRepo = new GroupRepository(prisma);
const groupService = new GroupService(groupRepo, auditService);

const ParamSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { id } = ParamSchema.parse(rawParams);

    const group = await groupRepo.findGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const timeline = await groupService.getTimeline(id);

    return NextResponse.json({
      ...group,
      timeline,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
