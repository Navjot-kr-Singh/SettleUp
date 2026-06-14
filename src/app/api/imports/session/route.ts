import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const where: any = {};
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;

    const sessions = await prisma.importSession.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
