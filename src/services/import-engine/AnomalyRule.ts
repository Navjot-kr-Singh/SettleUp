import { Prisma, AnomalySeverity } from '@prisma/client';
import { MembershipService } from '../membership';

export interface RuleContext {
  prisma: Prisma.TransactionClient;
  groupId: string;
  membershipService: MembershipService;
  allRawRecords: {
    rowNumber: number;
    fingerprint: string;
    date: Date | null;
    description: string;
    paidBy: string;
    amount: number | null;
    currency: string;
    splitType: string;
    splitWith: string[];
    splitDetails: string;
    notes: string;
    rawContent: string[];
  }[];
}

export interface RuleEvaluationResult {
  type: string;
  severity: AnomalySeverity;
  description: string;
  proposal?: {
    field: string;
    originalValue: string;
    proposedValue: string;
    reason: string;
  };
}

export interface AnomalyRule {
  name: string;
  evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]>;
}
