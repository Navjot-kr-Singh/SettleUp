import { Decimal } from 'decimal.js';

export interface RepaymentPlanItem {
  debtorId: string;
  creditorId: string;
  amount: number;
  reason: string;
}

export class DebtSimplificationService {
  /**
   * Simplifies debts in a group by matching creditors and debtors greedily.
   * Returns a list of minimal transfer recommendations.
   */
  calculateRepaymentPlan(userBalances: Record<string, Decimal | number>): RepaymentPlanItem[] {
    const plans: RepaymentPlanItem[] = [];

    // Separate into creditors (> 0) and debtors (< 0)
    let creditors = Object.entries(userBalances)
      .map(([userId, bal]) => ({ userId, balance: new Decimal(bal) }))
      .filter((u) => u.balance.gt(0.005))
      .sort((a, b) => b.balance.minus(a.balance).toNumber()); // Sort descending

    let debtors = Object.entries(userBalances)
      .map(([userId, bal]) => ({ userId, balance: new Decimal(bal) }))
      .filter((u) => u.balance.lt(-0.005))
      .sort((a, b) => a.balance.minus(b.balance).toNumber()); // Sort ascending (most negative first)

    while (creditors.length > 0 && debtors.length > 0) {
      const creditor = creditors[0];
      const debtor = debtors[0];

      // Transfer amount is the minimum of what debtor owes and what creditor is owed
      const absDebtorOwed = debtor.balance.abs();
      const amount = Decimal.min(creditor.balance, absDebtorOwed).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (amount.lte(0.005)) {
        break;
      }

      plans.push({
        debtorId: debtor.userId,
        creditorId: creditor.userId,
        amount: amount.toNumber(),
        reason: `Simplified repayment: User ${debtor.userId} pays User ${creditor.userId} ${amount.toFixed(2)} INR`,
      });

      // Update balances
      creditor.balance = creditor.balance.minus(amount);
      debtor.balance = debtor.balance.plus(amount);

      // Re-filter and re-sort lists
      creditors = creditors
        .filter((c) => c.balance.gt(0.005))
        .sort((a, b) => b.balance.minus(a.balance).toNumber());

      debtors = debtors
        .filter((d) => d.balance.lt(-0.005))
        .sort((a, b) => a.balance.minus(b.balance).toNumber());
    }

    return plans;
  }
}
