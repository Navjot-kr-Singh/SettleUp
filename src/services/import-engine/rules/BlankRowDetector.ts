import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class BlankRowDetector implements AnomalyRule {
  name = 'BlankRowDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    const isAllBlank = record.rawContent.every((c) => !c || c.trim() === '');

    if (isAllBlank) {
      results.push({
        type: 'BLANK_RECORD',
        severity: AnomalySeverity.INFO,
        description: `Row ${record.rowNumber} is entirely blank`,
        proposal: {
          field: 'status',
          originalValue: 'PENDING',
          proposedValue: 'REJECTED',
          reason: 'Entirely blank row. Propose rejecting.',
        },
      });
    }

    return results;
  }
}
