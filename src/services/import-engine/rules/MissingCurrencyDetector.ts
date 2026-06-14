import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class MissingCurrencyDetector implements AnomalyRule {
  name = 'MissingCurrencyDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    // Skip validation for blank records
    const isBlank = record.rawContent.every((c) => !c || c.trim() === '');
    if (isBlank) return results;

    if (!record.currency || record.currency.trim() === '') {
      results.push({
        type: 'MISSING_CURRENCY',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} is missing currency`,
        proposal: {
          field: 'currency',
          originalValue: '',
          proposedValue: 'INR',
          reason: 'Currency field is blank. Propose defaulting to base currency INR.',
        },
      });
    }

    return results;
  }
}
