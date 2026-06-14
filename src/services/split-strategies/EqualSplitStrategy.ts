import { Decimal } from 'decimal.js';
import { SplitStrategy, SplitParticipantInput, SplitResult } from './SplitStrategy';
import { calculateEqualSplit } from '@/utils/math';

export class EqualSplitStrategy implements SplitStrategy {
  calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[] {
    if (participants.length === 0) return [];
    
    const amounts = calculateEqualSplit(amount, participants.length);
    
    return participants.map((p, idx) => ({
      userId: p.userId,
      calculatedAmount: amounts[idx],
    }));
  }
}
