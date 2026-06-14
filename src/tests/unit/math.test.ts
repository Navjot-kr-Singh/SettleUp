import { describe, it, expect } from 'vitest';
import { calculateEqualSplit, calculatePercentageSplit, calculateSharesSplit } from '../../utils/math';
import { Decimal } from 'decimal.js';

describe('Split Math calculations', () => {
  describe('Equal Split Math', () => {
    it('should split 100 equally among 3 participants with penny adjustments', () => {
      const shares = calculateEqualSplit(100.00, 3);
      expect(shares.length).toBe(3);
      
      // Totals should sum to exactly 100.00
      const total = shares.reduce((acc, val) => acc.plus(val), new Decimal(0));
      expect(total.toNumber()).toBe(100.00);

      // Verify penny adjustment goes to the first participant:
      // 100 / 3 = 33.33333... Rounded: 33.33
      // Shares should be 33.34, 33.33, 33.33
      expect(shares[0].toNumber()).toBe(33.34);
      expect(shares[1].toNumber()).toBe(33.33);
      expect(shares[2].toNumber()).toBe(33.33);
    });

    it('should handle decimal precision values from CSV (Row 10 cylinder refill 899.995)', () => {
      const shares = calculateEqualSplit('899.995', 4);
      expect(shares.length).toBe(4);
      
      const total = shares.reduce((acc, val) => acc.plus(val), new Decimal(0));
      expect(total.toNumber()).toBe(900.00); // 899.995 rounds to 900.00

      // 900 / 4 = 225.00 each
      expect(shares[0].toNumber()).toBe(225.00);
      expect(shares[1].toNumber()).toBe(225.00);
      expect(shares[2].toNumber()).toBe(225.00);
      expect(shares[3].toNumber()).toBe(225.00);
    });
  });

  describe('Percentage Split Math', () => {
    it('should calculate splits based on exact percentages', () => {
      // 1000 INR split: 30%, 30%, 40%
      const shares = calculatePercentageSplit(1000, [30, 30, 40]);
      expect(shares[0].toNumber()).toBe(300);
      expect(shares[1].toNumber()).toBe(300);
      expect(shares[2].toNumber()).toBe(400);
    });

    it('should reject percentages that do not sum to 100', () => {
      // Row 15 Pizza Friday has percentages sum to 110%
      expect(() => {
        calculatePercentageSplit(1440, [30, 30, 30, 20]);
      }).toThrow('Percentages must sum to exactly 100%');
    });
  });

  describe('Shares Split Math', () => {
    it('should divide amounts based on ratios (Row 22 scooter rentals)', () => {
      // Amount 3600, ratios 1:2:1:2 (total = 6)
      const shares = calculateSharesSplit(3600, [1, 2, 1, 2]);
      expect(shares[0].toNumber()).toBe(600);
      expect(shares[1].toNumber()).toBe(1200);
      expect(shares[2].toNumber()).toBe(600);
      expect(shares[3].toNumber()).toBe(1200);
    });
  });
});
