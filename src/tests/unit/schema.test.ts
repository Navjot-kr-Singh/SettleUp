import { describe, it, expect } from 'vitest';
import { UserSchema, ExpenseSchema, SettlementSchema } from '../../types';

describe('Zod Schema Validations', () => {
  describe('User Validation', () => {
    it('should validate correct user data', () => {
      const result = UserSchema.safeParse({
        name: 'Aisha',
        email: 'aisha@settleup.com',
        role: 'MEMBER',
      });
      expect(result.success).toBe(true);
    });

    it('should validate guest users', () => {
      const result = UserSchema.safeParse({
        name: 'Kabir',
        role: 'GUEST',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email formats', () => {
      const result = UserSchema.safeParse({
        name: 'Aisha',
        email: 'invalid-email-format',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Expense Validation', () => {
    it('should reject expenses with empty descriptions', () => {
      const result = ExpenseSchema.safeParse({
        groupId: '00000000-0000-0000-0000-000000000000',
        paidById: '00000000-0000-0000-0000-000000000000',
        description: '',
        originalAmount: 100,
        originalCurrency: 'INR',
        date: new Date(),
        splitType: 'EQUAL',
        participants: [{ userId: '00000000-0000-0000-0000-000000000000' }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amounts', () => {
      const result = ExpenseSchema.safeParse({
        groupId: '00000000-0000-0000-0000-000000000000',
        paidById: '00000000-0000-0000-0000-000000000000',
        description: 'Dinner',
        originalAmount: -50,
        originalCurrency: 'INR',
        date: new Date(),
        splitType: 'EQUAL',
        participants: [{ userId: '00000000-0000-0000-0000-000000000000' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
