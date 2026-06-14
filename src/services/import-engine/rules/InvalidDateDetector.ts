import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class InvalidDateDetector implements AnomalyRule {
  name = 'InvalidDateDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const rawDateStr = record.rawContent[0] || '';

    if (!record.date) {
      let proposedVal = '';
      let reason = 'Unparseable date format. Propose manual correction.';

      // Heuristic: Mar-14 -> 2026-03-14
      if (/^[a-zA-Z]{3}-\d{1,2}$/.test(rawDateStr.trim())) {
        const [monthStr, dayStr] = rawDateStr.trim().split('-');
        const monthMap: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const monthNum = monthMap[monthStr.toLowerCase()];
        if (monthNum) {
          const dayPad = dayStr.padStart(2, '0');
          proposedVal = `2026-${monthNum}-${dayPad}`;
          reason = `Short month date format. Proposed normalization to ${proposedVal}.`;
        }
      }

      results.push({
        type: 'INVALID_DATE',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} has an invalid or unparseable date string: "${rawDateStr}"`,
        proposal: {
          field: 'date',
          originalValue: rawDateStr,
          proposedValue: proposedVal || '2026-02-01',
          reason,
        },
      });
    }

    return results;
  }
}
