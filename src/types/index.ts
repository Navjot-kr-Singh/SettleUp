import { z } from 'zod';

export const UserRoleSchema = z.enum(['MEMBER', 'GUEST']);
export const SplitTypeSchema = z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']);
export const ProposalStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const AnomalySeveritySchema = z.enum(['INFO', 'WARNING', 'ERROR', 'REVIEW_REQUIRED']);

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address').optional().nullable(),
  role: UserRoleSchema.default('MEMBER'),
});

export const ExpenseParticipantInputSchema = z.object({
  userId: z.string().uuid(),
  shareValue: z.number().nonnegative().optional(),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  paidById: z.string().uuid(),
  description: z.string().min(1, 'Description is required').max(100),
  originalAmount: z.number().positive('Amount must be positive'),
  originalCurrency: z.string().min(3).max(3),
  exchangeRate: z.number().positive().default(1.0),
  date: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date()),
  splitType: SplitTypeSchema,
  participants: z.array(ExpenseParticipantInputSchema).min(1, 'At least one participant required'),
  notes: z.string().optional().nullable(),
});

export const SettlementSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  amount: z.number().positive('Repayment amount must be positive'),
  currency: z.string().min(3).max(3),
  exchangeRate: z.number().positive().default(1.0),
  date: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date()),
  notes: z.string().optional().nullable(),
});
