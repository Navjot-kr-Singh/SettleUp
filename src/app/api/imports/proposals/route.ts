import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  field: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || undefined;
  const status = searchParams.get('status') || undefined;
  const field = searchParams.get('field') || undefined;
  const pageVal = searchParams.get('page') || undefined;
  const limitVal = searchParams.get('limit') || undefined;

  try {
    const validated = QuerySchema.parse({
      sessionId,
      status,
      field,
      page: pageVal ? parseInt(pageVal, 10) : undefined,
      limit: limitVal ? parseInt(limitVal, 10) : undefined,
    });

    const skip = (validated.page - 1) * validated.limit;

    const where: any = {};
    if (validated.sessionId) where.sessionId = validated.sessionId;
    if (validated.status) where.status = validated.status;
    if (validated.field) where.field = validated.field;

    const [proposals, total] = await Promise.all([
      prisma.dataChangeProposal.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip,
        take: validated.limit,
      }),
      prisma.dataChangeProposal.count({ where }),
    ]);

    return NextResponse.json({
      proposals,
      total,
      page: validated.page,
      limit: validated.limit,
      totalPages: Math.ceil(total / validated.limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
