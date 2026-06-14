import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/repositories/user.repo';

const userRepo = new UserRepository(prisma);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await userRepo.listUsers();
    // Return users without password hashes
    const sanitized = users.map(({ passwordHash, ...u }) => u);
    return NextResponse.json(sanitized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
