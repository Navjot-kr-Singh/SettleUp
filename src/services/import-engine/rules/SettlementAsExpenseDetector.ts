import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class SettlementAsExpenseDetector implements AnomalyRule {
  name = 'SettlementAsExpenseDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    const searchStr = `${record.description} ${record.notes}`.toLowerCase();
    const settlementKeywords = ['repaid', 'paid back', 'settle', 'settled', 'repayment'];

    const hasKeyword = settlementKeywords.some((key) => searchStr.includes(key));
    if (hasKeyword && record.splitType.toLowerCase() !== 'settlement') {
      results.push({
        type: 'SETTLEMENT_STORED_AS_EXPENSE',
        severity: AnomalySeverity.WARNING,
        description: `Row ${record.rowNumber} ("${record.description}") contains settlement keywords but is split as an expense`,
        proposal: {
          field: 'split_type',
          originalValue: record.splitType || 'equal',
          proposedValue: 'SETTLEMENT',
          reason: 'Description implies 1-to-1 repayment. Propose changing split type to SETTLEMENT.',
        },
      });
    }

    return results;
  }
}
