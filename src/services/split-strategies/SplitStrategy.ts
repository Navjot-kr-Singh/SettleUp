import { Decimal } from 'decimal.js';

export interface SplitParticipantInput {
  userId: string;
  shareValue?: Decimal;
}

export interface SplitResult {
  userId: string;
  calculatedAmount: Decimal;
}

export interface SplitStrategy {
  calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[];
}
