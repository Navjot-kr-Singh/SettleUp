import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CurrencyService } from '@/services/CurrencyService';
import { z } from 'zod';

const currencyService = new CurrencyService(prisma);

const CreateCurrencySchema = z.object({
  code: z.string().min(3).max(3),
  name: z.string().min(2).max(50),
  symbol: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currencies = await currencyService.listCurrencies();
    return NextResponse.json(currencies);
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
    const validated = CreateCurrencySchema.parse(body);

    const currency = await currencyService.addCurrency(
      validated.code,
      validated.name,
      validated.symbol ?? undefined
    );
    return NextResponse.json(currency, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
