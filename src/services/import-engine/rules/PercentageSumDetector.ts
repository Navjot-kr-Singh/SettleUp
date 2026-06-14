import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class PercentageSumDetector implements AnomalyRule {
  name = 'PercentageSumDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const splitType = record.splitType.toLowerCase().trim();
    const details = record.splitDetails.trim();

    if (splitType !== 'percentage' || !details) return results;

    const items = details.split(';').map((i) => i.trim()).filter(Boolean);
    let sum = 0;
    const parsed: { name: string; val: number }[] = [];

    for (const item of items) {
      const match = item.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%?$/);
      if (match) {
        const name = match[1].trim();
        const val = parseFloat(match[2]);
        sum += val;
        parsed.push({ name, val });
      }
    }

    if (Math.abs(sum - 100) > 0.01) {
      const rescaled = parsed
        .map((p) => {
          const rescaledVal = (p.val / sum) * 100;
          return `${p.name} ${rescaledVal.toFixed(2)}%`;
        })
        .join('; ');

      results.push({
        type: 'PERCENTAGE_SUM_ERROR',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} percentages sum to ${sum}% (should be 100%)`,
        proposal: {
          field: 'split_details',
          originalValue: record.splitDetails,
          proposedValue: rescaled,
          reason: `Percentages sum to ${sum}%. Propose proportional rescaling to 100%.`,
        },
      });
    }

    return results;
  }
}
