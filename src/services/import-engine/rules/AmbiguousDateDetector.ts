import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class AmbiguousDateDetector implements AnomalyRule {
  name = 'AmbiguousDateDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const rawDateStr = record.rawContent[0] || '';

    const match = rawDateStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);

      if (p1 <= 12 && p2 <= 12 && p1 !== p2) {
        results.push({
          type: 'AMBIGUOUS_DATE',
          severity: AnomalySeverity.WARNING,
          description: `Row ${record.rowNumber} has an ambiguous date format: "${rawDateStr}"`,
          proposal: {
            field: 'date',
            originalValue: rawDateStr,
            proposedValue: `2026-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`,
            reason: 'Date format is ambiguous (DD-MM-YYYY vs MM-DD-YYYY). Propose DD-MM-YYYY format.',
          },
        });
      }
    }

    return results;
  }
}
