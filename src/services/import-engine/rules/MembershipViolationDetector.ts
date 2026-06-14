import { AnomalySeverity } from '@prisma/client';
import { AnomalyRule, RuleContext, RuleEvaluationResult } from '../AnomalyRule';

export class MembershipViolationDetector implements AnomalyRule {
  name = 'MembershipViolationDetector';

  async evaluate(
    record: RuleContext['allRawRecords'][number],
    context: RuleContext
  ): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];

    if (!record.date) return results;

    const dbUsers = await context.prisma.user.findMany({
      select: { id: true, name: true, role: true },
    });

    const getNormalizedName = (rawName: string): string => {
      const lower = rawName.trim().toLowerCase();
      const match = dbUsers.find((u) => u.name.toLowerCase() === lower);
      return match ? match.name : rawName.trim();
    };

    // 1. Verify payer is active on date
    const payerName = getNormalizedName(record.paidBy);
    const payerUser = dbUsers.find((u) => u.name === payerName);
    if (payerUser) {
      if (payerUser.role !== 'GUEST') {
        const isActive = await context.membershipService.isUserActiveOnDate(
          context.groupId,
          payerUser.id,
          record.date
        );
        if (!isActive) {
          results.push({
            type: 'MEMBERSHIP_VIOLATION',
            severity: AnomalySeverity.ERROR,
            description: `Row ${record.rowNumber} payer "${payerName}" is not active on transaction date`,
            proposal: {
              field: 'paid_by',
              originalValue: record.paidBy,
              proposedValue: 'Aisha',
              reason: 'Payer was not a member on the transaction date. Propose reassigning.',
            },
          });
        }
      }
    }

    // 2. Verify participants are active on date
    for (const part of record.splitWith) {
      const partName = getNormalizedName(part);
      const partUser = dbUsers.find((u) => u.name === partName);
      if (partUser) {
        if (partUser.role !== 'GUEST') {
          const isActive = await context.membershipService.isUserActiveOnDate(
            context.groupId,
            partUser.id,
            record.date
          );
          if (!isActive) {
            results.push({
              type: 'MEMBERSHIP_VIOLATION',
              severity: AnomalySeverity.ERROR,
              description: `Row ${record.rowNumber} participant "${partName}" is not active on transaction date`,
              proposal: {
                field: 'split_with',
                originalValue: record.splitWith.join(';'),
                proposedValue: record.splitWith.filter((p) => getNormalizedName(p) !== partName).join(';'),
                reason: `Participant "${partName}" is inactive on transaction date. Suggest removing them from the split.`,
              },
            });
          }
        }
      }
    }

    return results;
  }
}
