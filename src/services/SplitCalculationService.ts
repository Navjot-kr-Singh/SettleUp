import { Decimal } from 'decimal.js';
import { SplitType } from '@prisma/client';
import { SplitStrategy, SplitParticipantInput, SplitResult } from './split-strategies/SplitStrategy';
import { EqualSplitStrategy } from './split-strategies/EqualSplitStrategy';
import { ExactSplitStrategy } from './split-strategies/ExactSplitStrategy';
import { PercentageSplitStrategy } from './split-strategies/PercentageSplitStrategy';
import { SharesSplitStrategy } from './split-strategies/SharesSplitStrategy';

export class SplitCalculationService {
  private strategies: Record<SplitType, SplitStrategy>;

  constructor() {
    this.strategies = {
      [SplitType.EQUAL]: new EqualSplitStrategy(),
      [SplitType.EXACT]: new ExactSplitStrategy(),
      [SplitType.PERCENTAGE]: new PercentageSplitStrategy(),
      [SplitType.SHARES]: new SharesSplitStrategy(),
    };
  }

  calculateSplits(
    amount: Decimal | number | string,
    splitType: SplitType,
    participants: SplitParticipantInput[]
  ): SplitResult[] {
    const strategy = this.strategies[splitType];
    if (!strategy) {
      throw new Error(`Unsupported split strategy type: ${splitType}`);
    }
    const totalAmount = new Decimal(amount);
    return strategy.calculate(totalAmount, participants);
  }
}
