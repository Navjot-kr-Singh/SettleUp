import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface ExplanationStep {
  date: Date;
  type: 'EXPENSE_PAID' | 'EXPENSE_SHARE' | 'SETTLEMENT_SENT' | 'SETTLEMENT_RECEIVED';
  description: string;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  baseINRAmount: number;
  impact: number;
  runningBalance: number;
}

export class BalanceExplanationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getBalanceExplanation(groupId: string, userId: string): Promise<ExplanationStep[]> {
    // 1. Fetch relevant active expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        groupId,
        deletedAt: null,
        OR: [
          { paidById: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        participants: {
          where: { userId },
        },
      },
    });

    // 2. Fetch relevant settlements
    const settlements = await this.prisma.settlement.findMany({
      where: {
        groupId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
    });

    // 3. Normalize into sorting items
    const items: { date: Date; data: any; type: 'EXPENSE' | 'SETTLEMENT' }[] = [];
    expenses.forEach((e) => items.push({ date: new Date(e.date), data: e, type: 'EXPENSE' }));
    settlements.forEach((s) => items.push({ date: new Date(s.date), data: s, type: 'SETTLEMENT' }));

    // Sort ascending chronologically
    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 4. Compute running balance steps
    const steps: ExplanationStep[] = [];
    let runningBalance = new Decimal(0);

    for (const item of items) {
      if (item.type === 'EXPENSE') {
        const e = item.data;
        const isPayer = e.paidById === userId;
        const participant = e.participants[0]; // will be defined if user is participant (due to include filters)
        const userShare = participant ? new Decimal(participant.calculatedAmount) : new Decimal(0);
        
        let impact = new Decimal(0);
        let eventType: 'EXPENSE_PAID' | 'EXPENSE_SHARE';
        let originalAmt = 0;
        let desc = e.description;

        if (isPayer) {
          eventType = 'EXPENSE_PAID';
          // Net credit: total paid amount in INR minus their own share
          impact = new Decimal(e.baseCurrencyAmount).minus(userShare);
          originalAmt = new Decimal(e.originalAmount).toNumber();
          desc = `${e.description} (Paid by User)`;
        } else {
          eventType = 'EXPENSE_SHARE';
          // Net debit: their share of the expense
          impact = userShare.negated();
          
          // Original amount representing their share
          const originalShareVal = participant.shareValue != null 
            ? new Decimal(participant.shareValue)
            : userShare.dividedBy(e.exchangeRate);
          originalAmt = originalShareVal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
          desc = `${e.description} (Share Owed)`;
        }

        runningBalance = runningBalance.plus(impact);

        steps.push({
          date: e.date,
          type: eventType,
          description: desc,
          originalAmount: originalAmt,
          originalCurrency: e.originalCurrency,
          exchangeRate: new Decimal(e.exchangeRate).toNumber(),
          baseINRAmount: new Decimal(e.baseCurrencyAmount).toNumber(),
          impact: impact.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
          runningBalance: runningBalance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        });
      } else {
        // SETTLEMENT
        const s = item.data;
        const isSender = s.senderId === userId;
        let impact = new Decimal(0);
        let eventType: 'SETTLEMENT_SENT' | 'SETTLEMENT_RECEIVED';
        let desc = '';

        if (isSender) {
          eventType = 'SETTLEMENT_SENT';
          impact = new Decimal(s.baseCurrencyAmount);
          desc = `Settlement sent to Receiver ${s.receiverId}`;
        } else {
          eventType = 'SETTLEMENT_RECEIVED';
          impact = new Decimal(s.baseCurrencyAmount).negated();
          desc = `Settlement received from Sender ${s.senderId}`;
        }

        runningBalance = runningBalance.plus(impact);

        steps.push({
          date: s.date,
          type: eventType,
          description: s.notes || desc,
          originalAmount: new Decimal(s.amount).toNumber(),
          originalCurrency: s.currency,
          exchangeRate: new Decimal(s.exchangeRate).toNumber(),
          baseINRAmount: new Decimal(s.baseCurrencyAmount).toNumber(),
          impact: impact.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
          runningBalance: runningBalance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        });
      }
    }

    return steps;
  }
}
