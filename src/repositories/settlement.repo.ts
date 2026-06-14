import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class SettlementRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createSettlement(data: {
    groupId: string;
    senderId: string;
    receiverId: string;
    amount: Decimal;
    currency: string;
    exchangeRate: Decimal;
    baseCurrencyAmount: Decimal;
    date: Date;
    notes?: string;
  }) {
    return this.prisma.settlement.create({
      data: {
        groupId: data.groupId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        amount: data.amount,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        baseCurrencyAmount: data.baseCurrencyAmount,
        date: data.date,
        notes: data.notes,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });
  }

  async findSettlementById(id: string) {
    return this.prisma.settlement.findUnique({
      where: { id },
      include: {
        sender: true,
        receiver: true,
      },
    });
  }

  async listSettlements(groupId: string) {
    return this.prisma.settlement.findMany({
      where: { groupId },
      orderBy: { date: 'desc' },
      include: {
        sender: true,
        receiver: true,
      },
    });
  }

  async updateSettlement(
    id: string,
    data: {
      amount: Decimal;
      currency: string;
      exchangeRate: Decimal;
      baseCurrencyAmount: Decimal;
      date: Date;
      notes?: string;
    }
  ) {
    return this.prisma.settlement.update({
      where: { id },
      data: {
        amount: data.amount,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        baseCurrencyAmount: data.baseCurrencyAmount,
        date: data.date,
        notes: data.notes,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });
  }

  async deleteSettlement(id: string) {
    return this.prisma.settlement.delete({
      where: { id },
      include: {
        sender: true,
        receiver: true,
      },
    });
  }
}

