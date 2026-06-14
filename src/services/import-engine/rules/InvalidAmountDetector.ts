import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class InvalidAmountDetector implements AnomalyRule {
  name = 'InvalidAmountDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const rawAmtStr = record.rawContent[3] || '';

    if (record.amount === null) {
      results.push({
        type: 'INVALID_AMOUNT',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} has an invalid or non-numeric amount: "${rawAmtStr}"`,
        proposal: {
          field: 'amount',
          originalValue: rawAmtStr,
          proposedValue: '1.00',
          reason: 'Non-numeric amount. Propose manual correction.',
        },
      });
      return results;
    }

    if (record.amount === 0) {
      results.push({
        type: 'ZERO_AMOUNT',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} has a zero amount: 0`,
        proposal: {
          field: 'amount',
          originalValue: '0',
          proposedValue: '1.00',
          reason: 'Zero amount. Propose manual value adjustment.',
        },
      });
    }

    return results;
  }
}
