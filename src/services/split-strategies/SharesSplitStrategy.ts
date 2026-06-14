import { Decimal } from 'decimal.js';
import { SplitStrategy, SplitParticipantInput, SplitResult } from './SplitStrategy';
import { calculateSharesSplit } from '@/utils/math';

export class SharesSplitStrategy implements SplitStrategy {
  calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[] {
    if (participants.length === 0) return [];
    
    const shares = participants.map(p => {
      if (!p.shareValue) {
        throw new Error(`Share ratio must be specified for user ${p.userId}`);
      }
      return p.shareValue.toNumber();
    });
    
    const amounts = calculateSharesSplit(amount, shares);
    
    return participants.map((p, idx) => ({
      userId: p.userId,
      calculatedAmount: amounts[idx],
    }));
  }
}
