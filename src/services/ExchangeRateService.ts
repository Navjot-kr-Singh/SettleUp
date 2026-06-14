import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class ExchangeRateService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addExchangeRate(fromCurrency: string, toCurrency: string, rate: Decimal | number, effectiveDate: Date) {
    return this.prisma.exchangeRate.create({
      data: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: new Decimal(rate),
        effectiveDate,
      },
    });
  }

  async getRateForDate(fromCurrency: string, toCurrency: string, date: Date): Promise<Decimal> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) return new Decimal(1.0);

    const rateRecord = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        effectiveDate: { lte: date },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    if (!rateRecord) {
      const defaultRate = await this.prisma.exchangeRate.findFirst({
        where: { fromCurrency: from, toCurrency: to },
      });
      if (defaultRate) return new Decimal(defaultRate.rate);
      
      throw new Error(`No exchange rate found for ${from} to ${to} on or before ${date.toISOString()}`);
    }

    return new Decimal(rateRecord.rate);
  }

  async convertToBase(
    amount: Decimal | number | string,
    fromCurrency: string,
    date: Date
  ): Promise<{ convertedAmount: Decimal; exchangeRate: Decimal }> {
    const amt = new Decimal(amount);
    const rate = await this.getRateForDate(fromCurrency, 'INR', date);
    const converted = amt.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      convertedAmount: converted,
      exchangeRate: rate,
    };
  }
}
