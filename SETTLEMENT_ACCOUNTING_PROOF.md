# Settlement Accounting Validation Proof

This document provides a formal mathematical proof that SettleUp's settlement repayment mechanics preserve the conservation of group balance.

---

## 1. Core Conservation Law

In a closed financial group $G$ containing $N$ users, the sum of all users' net balances must equal exactly zero at any point in time:

$$\sum_{i=1}^N Balance(U_i) = 0$$

- **Creditors** have a balance $> 0$.
- **Debtors** have a balance $< 0$.
- The sum of all creditor balances is exactly equal in magnitude to the sum of all debtor balances.

---

## 2. Mathematical Proof of Settlement Effect

Let a settlement transaction $S$ occur where user $A$ (the Sender/Debtor) transfers amount $X$ to user $B$ (the Receiver/Creditor).

Let $Balance(U_i)$ represent the balance of user $U_i$ before settlement $S$, where:
$$\sum_{i=1}^N Balance(U_i) = 0$$

After settlement $S$ is applied, the new balances $Balance'(U_i)$ are defined as:
- **Sender $A$'s new balance**:
  $$Balance'(A) = Balance(A) + X$$
- **Receiver $B$'s new balance**:
  $$Balance'(B) = Balance(B) - X$$
- **Other members' new balances**:
  $$Balance'(U_k) = Balance(U_k) \quad \forall k \neq A, B$$

### Sum of Balances After Settlement:
$$\sum_{i=1}^N Balance'(U_i) = Balance'(A) + Balance'(B) + \sum_{k \neq A, B} Balance'(U_k)$$

Substitute the definitions:
$$\sum_{i=1}^N Balance'(U_i) = (Balance(A) + X) + (Balance(B) - X) + \sum_{k \neq A, B} Balance(U_k)$$

Rearrange terms:
$$\sum_{i=1}^N Balance'(U_i) = Balance(A) + Balance(B) + X - X + \sum_{k \neq A, B} Balance(U_k)$$

Combine the terms:
$$\sum_{i=1}^N Balance'(U_i) = \left( Balance(A) + Balance(B) + \sum_{k \neq A, B} Balance(U_k) \right) + (X - X)$$

Simplify:
$$\sum_{i=1}^N Balance'(U_i) = \sum_{i=1}^N Balance(U_i) + 0$$

Since $\sum_{i=1}^N Balance(U_i) = 0$, we have:
$$\sum_{i=1}^N Balance'(U_i) = 0$$

**Conclusion**: The conservation of balance holds exactly. No value is lost, created, or leaked during a settlement transaction.

---

## 3. Worked Examples

### Example 1: Full Repayment
- **Roster**: Aisha, Rohan
- **Scenario**: Rohan owes Aisha ₹2,000.
- **Initial Balances**:
  - Aisha ($U_1$): $+2000$ (Creditor)
  - Rohan ($U_2$): $-2000$ (Debtor)
  - **Sum**: $(+2000) + (-2000) = 0$
- **Settlement**: Rohan pays Aisha ₹2,000. ($A = \text{Rohan}, B = \text{Aisha}, X = 2000$)
- **Balances After Settlement**:
  - Aisha: $Balance'(\text{Aisha}) = 2000 - 2000 = 0$
  - Rohan: $Balance'(\text{Rohan}) = -2000 + 2000 = 0$
  - **Sum**: $0 + 0 = 0$

### Example 2: Partial Repayment
- **Roster**: Aisha, Rohan, Priya
- **Scenario**: Rohan owes Priya ₹3,000.
- **Initial Balances**:
  - Aisha ($U_1$): $0$
  - Rohan ($U_2$): $-3000$ (Debtor)
  - Priya ($U_3$): $+3000$ (Creditor)
  - **Sum**: $0 + (-3000) + 3000 = 0$
- **Settlement**: Rohan pays Priya ₹2,500. ($A = \text{Rohan}, B = \text{Priya}, X = 2500$)
- **Balances After Settlement**:
  - Aisha: $Balance'(\text{Aisha}) = 0$
  - Rohan: $Balance'(\text{Rohan}) = -3000 + 2500 = -500$ (Still owes ₹500)
  - Priya: $Balance'(\text{Priya}) = 3000 - 2500 = +500$ (Still owed ₹500)
  - **Sum**: $0 + (-500) + 500 = 0$
