import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExchangeRateService } from '@/services/ExchangeRateService';
import { z } from 'zod';

const exchangeRateService = new ExchangeRateService(prisma);

const CreateExchangeRateSchema = z.object({
  fromCurrency: z.string().min(3).max(3),
  toCurrency: z.string().min(3).max(3).default('INR'),
  rate: z.number().positive(),
  effectiveDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date()),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { effectiveDate: 'desc' },
    });
    return NextResponse.json(rates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = CreateExchangeRateSchema.parse(body);

    const rateRecord = await exchangeRateService.addExchangeRate(
      validated.fromCurrency,
      validated.toCurrency,
      validated.rate,
      validated.effectiveDate
    );
    return NextResponse.json(rateRecord, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
