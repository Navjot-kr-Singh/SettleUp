import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class InvalidCurrencyDetector implements AnomalyRule {
  name = 'InvalidCurrencyDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    if (record.currency && record.currency.trim() !== '') {
      const code = record.currency.trim().toUpperCase();
      const curr = await context.prisma.currency.findUnique({
        where: { code },
      });

      if (!curr) {
        results.push({
          type: 'INVALID_CURRENCY',
          severity: AnomalySeverity.ERROR,
          description: `Row ${record.rowNumber} specifies an invalid currency code: "${record.currency}"`,
          proposal: {
            field: 'currency',
            originalValue: record.currency,
            proposedValue: 'INR',
            reason: `Currency code "${record.currency}" does not exist in the database. Propose converting to INR.`,
          },
        });
      }
    }

    return results;
  }
}
