import { PrismaClient } from '@prisma/client';

export class CurrencyService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addCurrency(code: string, name: string, symbol?: string) {
    return this.prisma.currency.upsert({
      where: { code: code.toUpperCase() },
      update: { name, symbol },
      create: { code: code.toUpperCase(), name, symbol },
    });
  }

  async listCurrencies() {
    return this.prisma.currency.findMany();
  }
}
