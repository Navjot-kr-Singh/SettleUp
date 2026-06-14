import { Prisma } from '@prisma/client';
import { MembershipService } from '../membership';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from './AnomalyRule';
import { DuplicateRecordDetector } from './rules/DuplicateRecordDetector';
import { ConflictingDuplicateDetector } from './rules/ConflictingDuplicateDetector';
import { MissingPayerDetector } from './rules/MissingPayerDetector';
import { MissingParticipantDetector } from './rules/MissingParticipantDetector';
import { InvalidDateDetector } from './rules/InvalidDateDetector';
import { AmbiguousDateDetector } from './rules/AmbiguousDateDetector';
import { InvalidAmountDetector } from './rules/InvalidAmountDetector';
import { NegativeAmountDetector } from './rules/NegativeAmountDetector';
import { MissingCurrencyDetector } from './rules/MissingCurrencyDetector';
import { InvalidCurrencyDetector } from './rules/InvalidCurrencyDetector';
import { SettlementAsExpenseDetector } from './rules/SettlementAsExpenseDetector';
import { UnknownUserDetector } from './rules/UnknownUserDetector';
import { MembershipViolationDetector } from './rules/MembershipViolationDetector';
import { PercentageSumDetector } from './rules/PercentageSumDetector';
import { ShareAllocationDetector } from './rules/ShareAllocationDetector';
import { BlankRowDetector } from './rules/BlankRowDetector';

export class AnomalyDetectorEngine {
  private rules: AnomalyRule[] = [];

  constructor() {
    this.rules = [
      new BlankRowDetector(),
      new DuplicateRecordDetector(),
      new ConflictingDuplicateDetector(),
      new MissingPayerDetector(),
      new MissingParticipantDetector(),
      new InvalidDateDetector(),
      new AmbiguousDateDetector(),
      new InvalidAmountDetector(),
      new NegativeAmountDetector(),
      new MissingCurrencyDetector(),
      new InvalidCurrencyDetector(),
      new SettlementAsExpenseDetector(),
      new UnknownUserDetector(),
      new MembershipViolationDetector(),
      new PercentageSumDetector(),
      new ShareAllocationDetector(),
    ];
  }

  async run(
    groupId: string,
    membershipService: MembershipService,
    allRawRecords: RuleContext['allRawRecords'],
    prisma: Prisma.TransactionClient
  ): Promise<Map<number, RuleEvaluationResult[]>> {
    const context: RuleContext = {
      prisma,
      groupId,
      membershipService,
      allRawRecords,
    };

    const recordResults = new Map<number, RuleEvaluationResult[]>();

    for (const record of allRawRecords) {
      const anomalies: RuleEvaluationResult[] = [];
      
      for (const rule of this.rules) {
        try {
          const res = await rule.evaluate(record, context);
          anomalies.push(...res);
        } catch (err) {
          console.error(`Rule ${rule.name} failed on row ${record.rowNumber}:`, err);
        }
      }

      if (anomalies.length > 0) {
        recordResults.set(record.rowNumber, anomalies);
      }
    }

    return recordResults;
  }
}
