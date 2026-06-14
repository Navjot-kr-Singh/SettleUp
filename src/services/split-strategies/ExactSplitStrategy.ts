import { Decimal } from 'decimal.js';
import { SplitStrategy, SplitParticipantInput, SplitResult } from './SplitStrategy';

export class ExactSplitStrategy implements SplitStrategy {
  calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[] {
    if (participants.length === 0) return [];
    
    let sum = new Decimal(0);
    const results: SplitResult[] = [];
    
    for (const p of participants) {
      if (!p.shareValue) {
        throw new Error(`Exact amount owed must be specified for user ${p.userId}`);
      }
      const val = p.shareValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      sum = sum.plus(val);
      results.push({
        userId: p.userId,
        calculatedAmount: val,
      });
    }
    
    const targetAmount = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const diff = targetAmount.minus(sum);
    
    if (!diff.isZero()) {
      throw new Error(
        `The sum of exact split values (${sum.toNumber()}) must equal the total expense amount (${targetAmount.toNumber()}).`
      );
    }
    
    return results;
  }
}
