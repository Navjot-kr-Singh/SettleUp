import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class ConflictingDuplicateDetector implements AnomalyRule {
  name = 'ConflictingDuplicateDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    if (!record.date) return results;

    const getSignificantWords = (desc: string) =>
      desc.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

    const recordWords = getSignificantWords(record.description);

    const conflict = context.allRawRecords.find((r) => {
      if (r.rowNumber === record.rowNumber || !r.date) return false;

      // Same calendar date
      const sameDate = r.date.toDateString() === record.date!.toDateString();
      if (!sameDate) return false;

      // Overlapping significant keywords
      const otherWords = getSignificantWords(r.description);
      const sharesWord = recordWords.some((w) => otherWords.includes(w));
      if (!sharesWord) return false;

      // Differs in payer or amount
      const diffPayer = r.paidBy.toLowerCase().trim() !== record.paidBy.toLowerCase().trim();
      const diffAmount = r.amount !== record.amount;

      return diffPayer || diffAmount;
    });

    if (conflict && conflict.rowNumber < record.rowNumber) {
      results.push({
        type: 'CONFLICTING_DUPLICATE',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} ("${record.description}") conflicts with Row ${conflict.rowNumber} ("${conflict.description}") on the same date with different payer/amount`,
        proposal: {
          field: 'status',
          originalValue: 'PENDING',
          proposedValue: 'REJECTED',
          reason: `Conflicting duplicate of Row ${conflict.rowNumber}. Suggest rejecting this row.`,
        },
      });
    }

    return results;
  }
}
