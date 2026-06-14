import { describe, it, expect } from 'vitest';
import { checkDateAmbiguity, parseCSVDate } from '../../utils/date';

describe('Date Parsing & Ambiguity checks', () => {
  describe('checkDateAmbiguity', () => {
    it('should identify ambiguous dates where both day and month <= 12', () => {
      const result = checkDateAmbiguity('04-05-2026'); // April 5 or May 4
      expect(result.isAmbiguous).toBe(true);
      expect(result.interpretations.length).toBe(2);
    });

    it('should identify unambiguous dates where day > 12', () => {
      const result = checkDateAmbiguity('15-03-2026'); // 15 > 12, can only be March 15
      expect(result.isAmbiguous).toBe(false);
    });

    it('should identify unambiguous dates where day equals month', () => {
      const result = checkDateAmbiguity('02-02-2026'); // Day and Month are same
      expect(result.isAmbiguous).toBe(false);
    });
  });

  describe('parseCSVDate', () => {
    it('should parse standard date format DD-MM-YYYY', () => {
      const date = parseCSVDate('12-02-2026');
      expect(date.getDate()).toBe(12);
      expect(date.getMonth()).toBe(1); // 0-based month index (1 = Feb)
      expect(date.getFullYear()).toBe(2026);
    });

    it('should parse short date formats using context year (Row 27 Airport cab Mar-14)', () => {
      const date = parseCSVDate('Mar-14', 2026);
      expect(date.getDate()).toBe(14);
      expect(date.getMonth()).toBe(2); // 2 = March
      expect(date.getFullYear()).toBe(2026);
    });
  });
});
