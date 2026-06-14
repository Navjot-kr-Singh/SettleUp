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

const CreateGroupSchema = z.object({
  name: z.string().min(3).max(100),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await groupRepo.listGroups();
    return NextResponse.json(groups);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorId = (session.user as any).id;
  if (!actorId) {
    return NextResponse.json({ error: 'Actor ID missing from session' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name } = CreateGroupSchema.parse(body);

    const group = await groupService.createGroup(name, actorId);
    const joinedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await groupService.addMember(group.id, actorId, joinedAt, 'Creator automatically joined.', actorId);
    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
