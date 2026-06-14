import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class UnknownUserDetector implements AnomalyRule {
  name = 'UnknownUserDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    const dbUsers = await context.prisma.user.findMany({
      select: { id: true, name: true },
    });

    const userNames = dbUsers.map((u) => u.name);

    const findMatch = (rawName: string): string | null => {
      const trimmed = rawName.trim();
      if (!trimmed) return null;

      const lower = trimmed.toLowerCase();
      const exactMatch = userNames.find((n) => n.toLowerCase() === lower);
      if (exactMatch) return exactMatch;

      const prefixMatch = userNames.find((n) => {
        const nLower = n.toLowerCase();
        return lower.startsWith(nLower) || nLower.startsWith(lower);
      });
      if (prefixMatch) return prefixMatch;

      const subMatch = userNames.find((n) => lower.includes(n.toLowerCase()));
      if (subMatch) return subMatch;

      return null;
    };

    // 1. Check Payer
    if (record.paidBy && record.paidBy.trim() !== '') {
      const match = findMatch(record.paidBy);
      if (!match) {
        results.push({
          type: 'UNKNOWN_USER',
          severity: AnomalySeverity.ERROR,
          description: `Row ${record.rowNumber} has an unknown payer: "${record.paidBy}"`,
          proposal: {
            field: 'paid_by',
            originalValue: record.paidBy,
            proposedValue: 'Aisha',
            reason: `Payer "${record.paidBy}" does not match any registered user. Propose manual mapping.`,
          },
        });
      } else if (match !== record.paidBy.trim()) {
        results.push({
          type: 'USER_MAPPING_REQUIRED',
          severity: AnomalySeverity.WARNING,
          description: `Row ${record.rowNumber} payer name "${record.paidBy}" requires normalization to "${match}"`,
          proposal: {
            field: 'paid_by',
            originalValue: record.paidBy,
            proposedValue: match,
            reason: `Normalize casing/spelling of payer to "${match}".`,
          },
        });
      }
    }

    // 2. Check Participants
    for (const part of record.splitWith) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const match = findMatch(trimmed);
      if (!match) {
        results.push({
          type: 'UNKNOWN_USER',
          severity: AnomalySeverity.ERROR,
          description: `Row ${record.rowNumber} split contains unknown participant: "${trimmed}"`,
          proposal: {
            field: 'split_with',
            originalValue: record.splitWith.join(';'),
            proposedValue: record.splitWith.map((p) => findMatch(p) || 'Aisha').join(';'),
            reason: `Participant "${trimmed}" does not match any registered user. Propose manual mapping.`,
          },
        });
      } else if (match !== trimmed) {
        results.push({
          type: 'USER_MAPPING_REQUIRED',
          severity: AnomalySeverity.WARNING,
          description: `Row ${record.rowNumber} participant name "${trimmed}" requires normalization to "${match}"`,
          proposal: {
            field: 'split_with',
            originalValue: record.splitWith.join(';'),
            proposedValue: record.splitWith.map((p) => findMatch(p) || p.trim()).join(';'),
            reason: `Normalize casing/spelling of participant to "${match}".`,
          },
        });
      }
    }

    return results;
  }
}
