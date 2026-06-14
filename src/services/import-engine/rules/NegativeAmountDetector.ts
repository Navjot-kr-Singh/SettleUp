import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class NegativeAmountDetector implements AnomalyRule {
  name = 'NegativeAmountDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    if (record.amount !== null && record.amount < 0) {
      results.push({
        type: 'NEGATIVE_AMOUNT',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} has a negative amount: ${record.amount}`,
        proposal: {
          field: 'amount',
          originalValue: String(record.amount),
          proposedValue: String(Math.abs(record.amount)),
          reason: 'Negative amount. Suggest absolute value (reversing split directions).',
        },
      });
    }

    return results;
  }
}
