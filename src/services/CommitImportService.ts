import {
  PrismaClient,
  ImportSessionStatus,
  AnomalySeverity,
  AuditActionType,
  SplitType,
  Prisma,
} from '@prisma/client';
import crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { ExchangeRateService } from './ExchangeRateService';
import { SplitCalculationService } from './SplitCalculationService';
import { AuditService } from './AuditService';
import { AuditLogRepository } from '../repositories/audit.repo';

// ─── Result Types ────────────────────────────────────────────────────────────

export interface CommitResult {
  sessionId: string;
  status: ImportSessionStatus;
  committedAt: Date;
  expensesCreated: number;
  settlementsCreated: number;
  snapshotVersion: number;
  correlationId: string;
}

// ─── Normalized Record Shape ─────────────────────────────────────────────────

interface NormalizedRecord {
  type: 'EXPENSE' | 'SETTLEMENT';
  date: string;
  description: string;
  paidById: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseCurrencyAmount: number;
  splitType: string;
  participants: { userId: string; shareValue?: number; calculatedAmount: number }[];
  // For settlements
  senderId?: string;
  receiverId?: string;
}

// ─── Commit Import Service ───────────────────────────────────────────────────

export class CommitImportService {
  private prisma: PrismaClient;
  private exchangeRate: ExchangeRateService;
  private splitCalc: SplitCalculationService;
  private auditService: AuditService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.exchangeRate = new ExchangeRateService(prisma);
    this.splitCalc = new SplitCalculationService();
    this.auditService = new AuditService(new AuditLogRepository(prisma));
  }

  // ── Main entry point ───────────────────────────────────────────────────────

  async commitSession(sessionId: string, actorId: string): Promise<CommitResult> {
    // ── STEP 1: Session Validation (outside transaction) ─────────────────────
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      include: {
        records: true,
        anomalies: true,
        proposals: true,
        auditLogs: true,
      },
    });

    if (!session) {
      throw new Error('COMMIT_REJECTED: Import session not found.');
    }
    if (session.status === ImportSessionStatus.COMMITTED) {
      throw new Error('COMMIT_REJECTED: Session is already COMMITTED. Duplicate commit blocked.');
    }
    if (session.status === ImportSessionStatus.COMMITTING) {
      throw new Error('COMMIT_REJECTED: Session is already COMMITTING. Concurrent commit blocked.');
    }
    if (session.status === ImportSessionStatus.FAILED) {
      throw new Error('COMMIT_REJECTED: Cannot commit a FAILED session.');
    }
    if (session.status === ImportSessionStatus.TERMINATED) {
      throw new Error('COMMIT_REJECTED: Cannot commit a TERMINATED session.');
    }
    if (session.status === ImportSessionStatus.REJECTED) {
      throw new Error('COMMIT_REJECTED: Cannot commit a REJECTED session.');
    }
    if (session.status !== ImportSessionStatus.APPROVED) {
      throw new Error(
        `COMMIT_REJECTED: Session must be APPROVED before committing. Current status: ${session.status}.`
      );
    }
    if (!session.groupId) {
      throw new Error('COMMIT_REJECTED: Session has no valid groupId.');
    }
    if (!session.fileHash) {
      throw new Error('COMMIT_REJECTED: Session is missing fileHash integrity marker.');
    }
    if (session.records.length === 0) {
      throw new Error('COMMIT_REJECTED: Session contains no ImportRecords to commit.');
    }

    // ── STEP 2: Commit Gate Validation ────────────────────────────────────────

    const errorAnomalies = session.anomalies.filter(
      (a) => a.severity === AnomalySeverity.ERROR && !a.isResolved
    );
    if (errorAnomalies.length > 0) {
      throw new Error(
        `COMMIT_REJECTED: Session has ${errorAnomalies.length} unresolved ERROR anomalies. Resolve before committing.`
      );
    }

    const pendingProposals = session.proposals.filter((p) => p.status === 'PENDING');
    if (pendingProposals.length > 0) {
      throw new Error(
        `COMMIT_REJECTED: Session has ${pendingProposals.length} unresolved DataChangeProposals.`
      );
    }

    if (session.auditLogs.length === 0) {
      throw new Error('COMMIT_REJECTED: Audit trail is missing. Cannot commit without traceability.');
    }

    // Validate all records have normalizedData
    const recordsMissingNormalized = session.records.filter(
      (r) => r.status !== 'REJECTED' && !r.normalizedData
    );
    if (recordsMissingNormalized.length > 0) {
      throw new Error(
        `COMMIT_REJECTED: ${recordsMissingNormalized.length} records are missing normalizedData. Re-run dry run.`
      );
    }

    const correlationId = crypto.randomUUID();

    // ── STEP 3: Commit Lock ───────────────────────────────────────────────────
    // Set status to COMMITTING to prevent concurrent commit attempts
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: { status: ImportSessionStatus.COMMITTING },
    });

    await this.auditService.logEvent({
      actorId,
      action: AuditActionType.IMPORT_COMMIT_START,
      entityType: 'IMPORT_SESSION',
      entityId: sessionId,
      importSessionId: sessionId,
      correlationId,
      notes: `Commit initiated for session ${sessionId}.`,
    });

    // ── STEP 4 + 5: Atomic Financial Commit ───────────────────────────────────
    try {
      let expensesCreated = 0;
      let settlementsCreated = 0;
      let snapshotVersion = 1;

      // Pre-commit zero-sum balance check
      await this.validateZeroSumBalance(session.groupId, 'PRE');

      await this.prisma.$transaction(async (tx) => {
        // Build resolved-proposal lookup: recordId -> field -> resolvedValue
        const proposalOverrides: Record<string, Record<string, string>> = {};
        for (const proposal of session.proposals) {
          if (proposal.recordId && proposal.status === 'APPROVED') {
            if (!proposalOverrides[proposal.recordId]) {
              proposalOverrides[proposal.recordId] = {};
            }
            proposalOverrides[proposal.recordId][proposal.field] =
              proposal.resolvedValue ?? proposal.proposedValue;
          }
        }

        // Process each non-rejected record
        for (const record of session.records) {
          if (record.status === 'REJECTED') continue;
          if (!record.normalizedData) continue;

          const normalized = record.normalizedData as unknown as NormalizedRecord;
          const overrides = proposalOverrides[record.id] || {};

          // Apply proposal overrides on top of normalized data
          if (overrides['paid_by']) normalized.paidById = overrides['paid_by'];
          if (overrides['amount']) normalized.amount = Number(overrides['amount']);
          if (overrides['currency']) normalized.currency = overrides['currency'];
          if (overrides['split_type']) normalized.splitType = overrides['split_type'];

          if (normalized.type === 'SETTLEMENT') {
            // ── Create Settlement ────────────────────────────────────────────
            const txDate = new Date(normalized.date);
            const { convertedAmount, exchangeRate: rate } = await this.exchangeRate.convertToBase(
              normalized.amount,
              normalized.currency,
              txDate
            );

            const senderId = normalized.senderId || normalized.paidById;
            const receiverId = normalized.receiverId || (normalized.participants[0]?.userId ?? '');

            if (!senderId || !receiverId) continue;

            const settlement = await tx.settlement.create({
              data: {
                groupId: session.groupId,
                senderId,
                receiverId,
                amount: new Decimal(normalized.amount),
                currency: normalized.currency.toUpperCase(),
                exchangeRate: rate,
                baseCurrencyAmount: convertedAmount,
                date: txDate,
                notes: normalized.description,
                importRecordId: record.id,
              },
            });
            settlementsCreated++;

            await tx.auditLog.create({
              data: {
                userId: actorId,
                action: AuditActionType.IMPORT_COMMIT_SETTLEMENT_CREATED,
                entityType: 'SETTLEMENT',
                entityId: settlement.id,
                correlationId,
                importSessionId: sessionId,
                afterState: settlement as any,
                notes: `Settlement created for row ${record.rowNumber}.`,
              },
            });
          } else {
            // ── Create Expense + Participants ────────────────────────────────
            const txDate = new Date(normalized.date);
            const { convertedAmount, exchangeRate: rate } = await this.exchangeRate.convertToBase(
              normalized.amount,
              normalized.currency,
              txDate
            );

            const splitTypeEnum = this.resolveSplitType(normalized.splitType);
            const participants = normalized.participants;

            if (!normalized.paidById || participants.length === 0) continue;

            const expense = await tx.expense.create({
              data: {
                groupId: session.groupId,
                paidById: normalized.paidById,
                description: normalized.description,
                originalAmount: new Decimal(normalized.amount),
                originalCurrency: normalized.currency.toUpperCase(),
                exchangeRate: rate,
                baseCurrencyAmount: convertedAmount,
                date: txDate,
                splitType: splitTypeEnum,
                notes: undefined,
                importRecordId: record.id,
                participants: {
                  create: participants.map((p) => ({
                    userId: p.userId,
                    shareValue: p.shareValue != null ? new Decimal(p.shareValue) : null,
                    calculatedAmount: new Decimal(p.calculatedAmount),
                  })),
                },
              },
            });
            expensesCreated++;

            await tx.auditLog.create({
              data: {
                userId: actorId,
                action: AuditActionType.IMPORT_COMMIT_EXPENSE_CREATED,
                entityType: 'EXPENSE',
                entityId: expense.id,
                correlationId,
                importSessionId: sessionId,
                afterState: expense as any,
                notes: `Expense created for row ${record.rowNumber}.`,
              },
            });
          }

          // Mark ImportRecord as IMPORTED
          await tx.importRecord.update({
            where: { id: record.id },
            data: { status: 'IMPORTED' },
          });
        }

        // ── STEP 6: Rebuild BalanceSnapshot inside transaction ────────────────
        const latestSnapshot = await tx.balanceSnapshot.findFirst({
          where: { groupId: session.groupId },
          orderBy: { version: 'desc' },
        });
        const nextVersion = latestSnapshot ? latestSnapshot.version + 1 : 1;
        snapshotVersion = nextVersion;

        await tx.balanceSnapshot.updateMany({
          where: { groupId: session.groupId, isCurrent: true },
          data: { isCurrent: false },
        });

        // Compute fresh balances via raw query inside the same transaction
        const expenses = await tx.expense.findMany({
          where: { groupId: session.groupId, deletedAt: null },
          include: { participants: true },
        });
        const settlements = await tx.settlement.findMany({
          where: { groupId: session.groupId },
        });
        const memberships = await tx.groupMembership.findMany({
          where: { groupId: session.groupId },
          select: { userId: true },
        });

        const balances: Record<string, Decimal> = {};
        memberships.forEach((m) => { balances[m.userId] = new Decimal(0); });
        expenses.forEach((e) => {
          if (!balances[e.paidById]) balances[e.paidById] = new Decimal(0);
          balances[e.paidById] = balances[e.paidById].plus(e.baseCurrencyAmount);
          e.participants.forEach((p) => {
            if (!balances[p.userId]) balances[p.userId] = new Decimal(0);
            balances[p.userId] = balances[p.userId].minus(p.calculatedAmount);
          });
        });
        settlements.forEach((s) => {
          if (!balances[s.senderId]) balances[s.senderId] = new Decimal(0);
          if (!balances[s.receiverId]) balances[s.receiverId] = new Decimal(0);
          balances[s.senderId] = balances[s.senderId].plus(s.baseCurrencyAmount);
          balances[s.receiverId] = balances[s.receiverId].minus(s.baseCurrencyAmount);
        });

        const balanceList = Object.entries(balances).map(([userId, bal]) => ({
          userId,
          netBalance: bal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        }));

        const newSnapshot = await tx.balanceSnapshot.create({
          data: {
            groupId: session.groupId,
            balances: balanceList,
            version: nextVersion,
            isCurrent: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: AuditActionType.IMPORT_COMMIT_BALANCE_REBUILT,
            entityType: 'BALANCE_SNAPSHOT',
            entityId: newSnapshot.id,
            correlationId,
            importSessionId: sessionId,
            afterState: { version: nextVersion, balanceCount: balanceList.length } as any,
            notes: `Balance snapshot rebuilt to version ${nextVersion}.`,
          },
        });

        // ── STEP 7: Mark session COMMITTED inside transaction ─────────────────
        const now = new Date();
        await tx.importSession.update({
          where: { id: sessionId },
          data: {
            status: ImportSessionStatus.COMMITTED,
            committedAt: now,
            committedBy: actorId,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: AuditActionType.IMPORT_COMMIT_COMPLETE,
            entityType: 'IMPORT_SESSION',
            entityId: sessionId,
            correlationId,
            importSessionId: sessionId,
            afterState: {
              expensesCreated,
              settlementsCreated,
              snapshotVersion: nextVersion,
            } as any,
            notes: `Commit complete. ${expensesCreated} expenses, ${settlementsCreated} settlements created.`,
          },
        });
      }, { maxWait: 15000, timeout: 30000 });

      // Post-commit zero-sum validation
      await this.validateZeroSumBalance(session.groupId, 'POST');

      const finalSession = await this.prisma.importSession.findUnique({
        where: { id: sessionId },
      });

      return {
        sessionId,
        status: ImportSessionStatus.COMMITTED,
        committedAt: finalSession?.committedAt ?? new Date(),
        expensesCreated,
        settlementsCreated,
        snapshotVersion,
        correlationId,
      };
    } catch (error: any) {
      // ── Failure Flow: rollback everything, mark session FAILED ────────────
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: ImportSessionStatus.FAILED },
      });

      await this.auditService.logEvent({
        actorId,
        action: AuditActionType.IMPORT_COMMIT_FAILED,
        entityType: 'IMPORT_SESSION',
        entityId: sessionId,
        importSessionId: sessionId,
        correlationId,
        notes: `Commit failed: ${error.message}`,
      });

      throw error;
    }
  }

  // ── Get Commit Status ──────────────────────────────────────────────────────

  async getCommitStatus(sessionId: string): Promise<{
    sessionId: string;
    status: ImportSessionStatus;
    committedAt: Date | null;
    expensesCreated: number;
    settlementsCreated: number;
    snapshotVersion: number | null;
  }> {
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Import session not found.');
    }

    let expensesCreated = 0;
    let settlementsCreated = 0;
    let snapshotVersion: number | null = null;

    if (session.status === ImportSessionStatus.COMMITTED) {
      const [expenseCount, settlementCount, snapshot] = await Promise.all([
        this.prisma.expense.count({ where: { importRecord: { sessionId } } }),
        this.prisma.settlement.count({ where: { importRecord: { sessionId } } }),
        this.prisma.balanceSnapshot.findFirst({
          where: { groupId: session.groupId, isCurrent: true },
          orderBy: { version: 'desc' },
        }),
      ]);
      expensesCreated = expenseCount;
      settlementsCreated = settlementCount;
      snapshotVersion = snapshot?.version ?? null;
    }

    return {
      sessionId,
      status: session.status,
      committedAt: session.committedAt,
      expensesCreated,
      settlementsCreated,
      snapshotVersion,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async validateZeroSumBalance(groupId: string, phase: 'PRE' | 'POST'): Promise<void> {
    const snapshot = await this.prisma.balanceSnapshot.findFirst({
      where: { groupId, isCurrent: true },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) return; // No snapshot yet — first-time group, skip

    const balances = snapshot.balances as { userId: string; netBalance: number }[];
    const sum = balances.reduce((acc, b) => acc.plus(b.netBalance), new Decimal(0));

    if (sum.abs().gt(0.01)) {
      throw new Error(
        `BALANCE_INTEGRITY_FAILURE: ${phase}-commit balance sum is non-zero: ${sum.toFixed(4)}`
      );
    }
  }

  private resolveSplitType(raw: string): SplitType {
    const upper = raw.trim().toUpperCase();
    const map: Record<string, SplitType> = {
      EQUAL: SplitType.EQUAL,
      EXACT: SplitType.EXACT,
      PERCENTAGE: SplitType.PERCENTAGE,
      SHARES: SplitType.SHARES,
      SHARE: SplitType.SHARES,
    };
    return map[upper] ?? SplitType.EQUAL;
  }
}
