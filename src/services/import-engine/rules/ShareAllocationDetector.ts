import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class ShareAllocationDetector implements AnomalyRule {
  name = 'ShareAllocationDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const splitType = record.splitType.toLowerCase().trim();
    const details = record.splitDetails.trim();

    if (splitType !== 'shares' && splitType !== 'share') return results;

    if (!details) {
      results.push({
        type: 'SHARE_ALLOCATION_ERROR',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} is missing share split details`,
        proposal: {
          field: 'split_details',
          originalValue: '',
          proposedValue: record.splitWith.map((p) => `${p.trim()} 1`).join('; '),
          reason: 'Shares split details are blank. Propose defaulting to 1 share each.',
        },
      });
      return results;
    }

    const items = details.split(';').map((i) => i.trim()).filter(Boolean);
    let totalShares = 0;
    let hasUnparseable = false;

    for (const item of items) {
      const match = item.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      if (match) {
        totalShares += parseFloat(match[2]);
      } else {
        hasUnparseable = true;
      }
    }

    if (hasUnparseable || totalShares <= 0) {
      results.push({
        type: 'SHARE_ALLOCATION_ERROR',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} has unparseable share split details: "${record.splitDetails}"`,
        proposal: {
          field: 'split_details',
          originalValue: record.splitDetails,
          proposedValue: record.splitWith.map((p) => `${p.trim()} 1`).join('; '),
          reason: 'Invalid shares splits format. Propose defaulting to 1 share each.',
        },
      });
    }

    return results;
  }
}
