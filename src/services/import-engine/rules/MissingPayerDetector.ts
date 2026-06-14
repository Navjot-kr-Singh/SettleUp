import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class MissingPayerDetector implements AnomalyRule {
  name = 'MissingPayerDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    if (!record.paidBy || record.paidBy.trim() === '') {
      results.push({
        type: 'MISSING_PAYER',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} is missing the payer ("paid_by" / "payer" field)`,
        proposal: {
          field: 'paid_by',
          originalValue: '',
          proposedValue: 'Aisha',
          reason: 'Payer field is blank. Propose reassigning to primary member Aisha.',
        },
      });
    }

    return results;
  }
}
