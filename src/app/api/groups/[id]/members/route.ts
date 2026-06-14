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

const GroupParamSchema = z.object({
  id: z.string().uuid(),
});

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  joinedAt: z.string().optional(),
  notes: z.string().optional(),
});

const RemoveMemberSchema = z.object({
  userId: z.string().uuid(),
  leftAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorId = (session.user as any).id;
  if (!actorId) {
    return NextResponse.json({ error: 'Actor ID missing from session' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { id: groupId } = GroupParamSchema.parse(rawParams);

    const body = await req.json();
    const { userId, joinedAt, notes } = AddMemberSchema.parse(body);

    const joinedDate = joinedAt ? new Date(joinedAt) : new Date();

    await groupService.addMember(groupId, userId, joinedDate, notes, actorId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorId = (session.user as any).id;
  if (!actorId) {
    return NextResponse.json({ error: 'Actor ID missing from session' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { id: groupId } = GroupParamSchema.parse(rawParams);

    const body = await req.json();
    const { userId, leftAt, notes } = RemoveMemberSchema.parse(body);

    const leftDate = leftAt ? new Date(leftAt) : new Date();

    await groupService.removeMember(groupId, userId, leftDate, notes, actorId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
