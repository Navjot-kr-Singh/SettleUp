import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class DuplicateRecordDetector implements AnomalyRule {
  name = 'DuplicateRecordDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    
    if (!record.fingerprint) return results;

    const firstOccur = context.allRawRecords.find(
      (r) => r.fingerprint === record.fingerprint
    );

    if (firstOccur && firstOccur.rowNumber < record.rowNumber) {
      results.push({
        type: 'DUPLICATE_RECORD',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} is an exact duplicate of Row ${firstOccur.rowNumber}`,
        proposal: {
          field: 'status',
          originalValue: 'PENDING',
          proposedValue: 'REJECTED',
          reason: `Exact duplicate of Row ${firstOccur.rowNumber}`,
        },
      });
    }

    return results;
  }
}
