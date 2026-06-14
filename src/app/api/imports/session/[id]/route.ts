import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ParamSchema = z.object({
  id: z.string().uuid(),
});

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
  status: z.string().optional(),
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

    const { searchParams } = new URL(req.url);
    const pageVal = searchParams.get('page') || undefined;
    const limitVal = searchParams.get('limit') || undefined;
    const status = searchParams.get('status') || undefined;

    const query = QuerySchema.parse({
      page: pageVal ? parseInt(pageVal, 10) : undefined,
      limit: limitVal ? parseInt(limitVal, 10) : undefined,
      status,
    });

    const session = await prisma.importSession.findUnique({
      where: { id },
      include: {
        anomalies: true,
        proposals: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    const skip = (query.page - 1) * query.limit;
    const where: any = { sessionId: id };
    if (query.status) where.status = query.status;

    const [records, totalRecords] = await Promise.all([
      prisma.importRecord.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.importRecord.count({ where }),
    ]);

    return NextResponse.json({
      session,
      records,
      totalRecords,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(totalRecords / query.limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
