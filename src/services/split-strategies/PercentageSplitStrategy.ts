import { Decimal } from 'decimal.js';
import { SplitStrategy, SplitParticipantInput, SplitResult } from './SplitStrategy';
import { calculatePercentageSplit } from '@/utils/math';

export class PercentageSplitStrategy implements SplitStrategy {
  calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[] {
    if (participants.length === 0) return [];
    
    const percentages = participants.map(p => {
      if (!p.shareValue) {
        throw new Error(`Percentage share must be specified for user ${p.userId}`);
      }
      return p.shareValue.toNumber();
    });
    
    const amounts = calculatePercentageSplit(amount, percentages);
    
    return participants.map((p, idx) => ({
      userId: p.userId,
      calculatedAmount: amounts[idx],
    }));
  }
}
