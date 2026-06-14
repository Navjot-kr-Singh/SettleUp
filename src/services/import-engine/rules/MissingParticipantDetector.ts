import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class MissingParticipantDetector implements AnomalyRule {
  name = 'MissingParticipantDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    // Skip verification if blank record
    const isBlank = record.rawContent.every((c) => !c || c.trim() === '');
    if (isBlank) return results;

    if (!record.splitWith || record.splitWith.length === 0) {
      results.push({
        type: 'MISSING_PARTICIPANTS',
        severity: AnomalySeverity.ERROR,
        description: `Row ${record.rowNumber} has no split participants specified ("split_with" field is empty)`,
        proposal: {
          field: 'split_with',
          originalValue: '',
          proposedValue: 'Aisha;Rohan',
          reason: 'No participants specified. Propose splitting between active members Aisha and Rohan.',
        },
      });
    }

    return results;
  }
}
