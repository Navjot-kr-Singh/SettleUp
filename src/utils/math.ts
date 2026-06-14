import { Decimal } from 'decimal.js';

// Set precision high enough for precise financial math
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function calculateEqualSplit(amount: Decimal | number | string, participantCount: number): Decimal[] {
  // Round the total amount to standard currency units (2 decimals) first
  const total = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (participantCount <= 0) return [];
  
  const share = total.div(participantCount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const result: Decimal[] = Array(participantCount).fill(share);
  
  // Resolve any remaining rounding differences by adjusting the first participant's share
  const sum = result.reduce((acc, val) => acc.plus(val), new Decimal(0));
  const difference = total.minus(sum);
  if (!difference.isZero()) {
    result[0] = result[0].plus(difference);
  }
  
  return result;
}

export function calculatePercentageSplit(amount: Decimal | number | string, percentages: number[]): Decimal[] {
  // Round the total amount to standard currency units (2 decimals) first
  const total = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (percentages.length === 0) return [];
  
  // Check if sum of percentages matches 100% exactly
  const sumPct = percentages.reduce((acc, p) => acc + p, 0);
  if (Math.abs(sumPct - 100) > 0.0001) {
    throw new Error(`Percentages must sum to exactly 100%. Provided: ${sumPct}%`);
  }
  
  const result: Decimal[] = percentages.map(pct => 
    total.times(pct).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  );
  
  // Resolve rounding adjustments
  const sum = result.reduce((acc, val) => acc.plus(val), new Decimal(0));
  const difference = total.minus(sum);
  if (!difference.isZero()) {
    result[0] = result[0].plus(difference);
  }
  
  return result;
}

export function calculateSharesSplit(amount: Decimal | number | string, shares: number[]): Decimal[] {
  // Round the total amount to standard currency units (2 decimals) first
  const total = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (shares.length === 0) return [];
  
  const totalShares = shares.reduce((acc, s) => acc + s, 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than zero.');
  }
  
  const result: Decimal[] = shares.map(share => 
    total.times(share).div(totalShares).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  );
  
  // Resolve rounding adjustments
  const sum = result.reduce((acc, val) => acc.plus(val), new Decimal(0));
  const difference = total.minus(sum);
  if (!difference.isZero()) {
    result[0] = result[0].plus(difference);
  }
  
  return result;
}
