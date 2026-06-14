import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportSessionStatus, AnomalySeverity, AuditActionType } from '@prisma/client';
import { CommitImportService } from '../../services/CommitImportService';

// ─── Shared Normalized Record Fixture ────────────────────────────────────────

const makeNormalizedExpense = () => ({
  type: 'EXPENSE',
  date: '2026-02-15',
  description: 'Pizza Friday',
  paidById: 'u-aisha',
  amount: 1000,
  currency: 'INR',
  exchangeRate: 1.0,
  baseCurrencyAmount: 1000,
  splitType: 'equal',
  participants: [
    { userId: 'u-aisha', calculatedAmount: 500 },
    { userId: 'u-rohan', calculatedAmount: 500 },
  ],
});

// ─── Base Mock Prisma Builder ─────────────────────────────────────────────────

function buildApprovedSession(overrides: Partial<any> = {}) {
  return {
    id: 'sess-approved',
    groupId: 'g-1',
    fileName: 'data.csv',
    fileHash: 'sha256-abc',
    status: ImportSessionStatus.APPROVED,
    committedAt: null,
    committedBy: null,
    records: [
      {
        id: 'rec-1',
        rowNumber: 2,
        status: 'PENDING',
        normalizedData: makeNormalizedExpense(),
      },
    ],
    anomalies: [],
    proposals: [],
    auditLogs: [{ id: 'audit-1' }],
    ...overrides,
  };
}

function buildMockPrisma(sessionOverrides: Partial<any> = {}, txOverrides: Partial<any> = {}) {
  const session = buildApprovedSession(sessionOverrides);

  const mockPrisma: any = {
    importSession: {
      findUnique: vi.fn().mockResolvedValue(session),
      update: vi.fn().mockResolvedValue({ ...session, status: ImportSessionStatus.COMMITTED, committedAt: new Date() }),
    },
    expense: {
      create: vi.fn().mockResolvedValue({ id: 'exp-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    settlement: {
      create: vi.fn().mockResolvedValue({ id: 'set-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    expenseParticipant: {
      create: vi.fn().mockResolvedValue({ id: 'ep-1' }),
    },
    balanceSnapshot: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'snap-1',
        version: 5,
        isCurrent: true,
        balances: [
          { userId: 'u-aisha', netBalance: 0 },
          { userId: 'u-rohan', netBalance: 0 },
        ],
      }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'snap-2', version: 6 }),
    },
    importRecord: {
      update: vi.fn().mockResolvedValue({}),
    },
    groupMembership: {
      findMany: vi.fn().mockResolvedValue([
        { userId: 'u-aisha' },
        { userId: 'u-rohan' },
      ]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'alog-1' }),
    },
    exchangeRate: {
      findFirst: vi.fn().mockResolvedValue({ rate: 1.0 }),
    },
    $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    ...txOverrides,
  };

  return mockPrisma;
}

// ─── TEST SUITES ─────────────────────────────────────────────────────────────

describe('SettleUp Commit Engine Suite', () => {
  // ── Commit Validation ─────────────────────────────────────────────────────

  describe('Commit Session Validation', () => {
    it('shouldRejectNonApprovedSession', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.REVIEW_REQUIRED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'Session must be APPROVED'
      );
    });

    it('shouldRejectRejectedSession', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.REJECTED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'COMMIT_REJECTED: Cannot commit a REJECTED session.'
      );
    });

    it('shouldRejectFailedSession', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.FAILED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'COMMIT_REJECTED: Cannot commit a FAILED session.'
      );
    });

    it('shouldRejectTerminatedSession', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.TERMINATED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'COMMIT_REJECTED: Cannot commit a TERMINATED session.'
      );
    });

    it('shouldRejectAlreadyCommittedSession', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.COMMITTED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'COMMIT_REJECTED: Session is already COMMITTED. Duplicate commit blocked.'
      );
    });
  });

  // ── Commit Gate ───────────────────────────────────────────────────────────

  describe('Commit Gate Validation', () => {
    it('shouldRejectErrorSeverityAnomalies', async () => {
      const mockPrisma = buildMockPrisma({
        anomalies: [{ id: 'a-1', severity: AnomalySeverity.ERROR, isResolved: false }],
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'unresolved ERROR anomalies'
      );
    });

    it('shouldRejectPendingProposals', async () => {
      const mockPrisma = buildMockPrisma({
        proposals: [{ id: 'p-1', status: 'PENDING', recordId: 'rec-1' }],
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'unresolved DataChangeProposals'
      );
    });

    it('shouldRejectMissingNormalizedData', async () => {
      const mockPrisma = buildMockPrisma({
        records: [{ id: 'rec-1', rowNumber: 2, status: 'PENDING', normalizedData: null }],
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-1', 'u-actor')).rejects.toThrow(
        'missing normalizedData'
      );
    });
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  describe('Idempotency Protection', () => {
    it('shouldPreventDoubleCommit', async () => {
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.COMMITTED });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-approved', 'u-actor')).rejects.toThrow(
        'Duplicate commit blocked'
      );
    });

    it('shouldReturnExistingCommitResultForDuplicateRequest', async () => {
      // Already-committed session with status endpoint should return without error
      const mockPrisma = buildMockPrisma({ status: ImportSessionStatus.COMMITTED });
      mockPrisma.importSession.findUnique = vi.fn().mockResolvedValue({
        ...buildApprovedSession({ status: ImportSessionStatus.COMMITTED }),
        committedAt: new Date('2026-02-15'),
      });
      const service = new CommitImportService(mockPrisma);
      const statusResult = await service.getCommitStatus('sess-approved');
      expect(statusResult.status).toBe(ImportSessionStatus.COMMITTED);
      expect(statusResult.committedAt).toBeDefined();
    });
  });

  // ── Atomicity & Rollback ──────────────────────────────────────────────────

  describe('Atomicity & Rollback Safety', () => {
    it('shouldRollbackIfExpenseCreationFails', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.$transaction = vi.fn(async () => {
        throw new Error('DB constraint violation on expense insert');
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-approved', 'u-actor')).rejects.toThrow(
        'DB constraint violation on expense insert'
      );
      // Session should be marked FAILED
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImportSessionStatus.FAILED }),
        })
      );
      // Audit log for failure should be written
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: AuditActionType.IMPORT_COMMIT_FAILED }),
        })
      );
    });

    it('shouldRollbackIfSettlementCreationFails', async () => {
      const settlementRecord = buildApprovedSession({
        records: [{
          id: 'rec-2',
          rowNumber: 3,
          status: 'PENDING',
          normalizedData: {
            type: 'SETTLEMENT',
            date: '2026-03-01',
            description: 'Rohan pays Aisha',
            paidById: 'u-rohan',
            amount: 500,
            currency: 'INR',
            exchangeRate: 1.0,
            baseCurrencyAmount: 500,
            splitType: 'settlement',
            senderId: 'u-rohan',
            receiverId: 'u-aisha',
            participants: [{ userId: 'u-aisha', calculatedAmount: 500 }],
          },
        }],
      });
      const mockPrisma = buildMockPrisma(settlementRecord);
      mockPrisma.$transaction = vi.fn(async () => {
        throw new Error('Foreign key constraint on settlement');
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-approved', 'u-actor')).rejects.toThrow(
        'Foreign key constraint on settlement'
      );
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImportSessionStatus.FAILED }),
        })
      );
    });

    it('shouldRollbackIfSnapshotRebuildFails', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.$transaction = vi.fn(async () => {
        throw new Error('Snapshot rebuild failed: unique constraint');
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-approved', 'u-actor')).rejects.toThrow(
        'Snapshot rebuild failed'
      );
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImportSessionStatus.FAILED }),
        })
      );
    });
  });

  // ── Audit Trail ───────────────────────────────────────────────────────────

  describe('Audit Trail Verification', () => {
    it('shouldCreateCommitAuditChain', async () => {
      const mockPrisma = buildMockPrisma();
      const service = new CommitImportService(mockPrisma);
      await service.commitSession('sess-approved', 'u-actor');

      // COMMITTING lock audit
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: AuditActionType.IMPORT_COMMIT_START }),
        })
      );
      // Complete audit
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: AuditActionType.IMPORT_COMMIT_COMPLETE }),
        })
      );
    });

    it('shouldGenerateSingleCorrelationId', async () => {
      const mockPrisma = buildMockPrisma();
      const service = new CommitImportService(mockPrisma);
      await service.commitSession('sess-approved', 'u-actor');

      // Collect all correlation IDs used in auditLog.create calls
      const createCalls = mockPrisma.auditLog.create.mock.calls;
      const correlationIds = new Set(
        createCalls
          .map((call: any) => call[0]?.data?.correlationId)
          .filter(Boolean)
      );
      expect(correlationIds.size).toBe(1);
    });
  });

  // ── Balance Engine ────────────────────────────────────────────────────────

  describe('Balance Engine Integration', () => {
    it('shouldRebuildSnapshotAfterCommit', async () => {
      const mockPrisma = buildMockPrisma();
      const service = new CommitImportService(mockPrisma);
      await service.commitSession('sess-approved', 'u-actor');

      // Snapshot was archived
      expect(mockPrisma.balanceSnapshot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isCurrent: false }),
        })
      );
      // New snapshot created
      expect(mockPrisma.balanceSnapshot.create).toHaveBeenCalled();
    });

    it('shouldPreserveHistoricalSnapshots', async () => {
      const mockPrisma = buildMockPrisma();
      const service = new CommitImportService(mockPrisma);
      await service.commitSession('sess-approved', 'u-actor');

      // Old snapshots marked isCurrent=false (not deleted)
      expect(mockPrisma.balanceSnapshot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isCurrent: true }),
          data: expect.objectContaining({ isCurrent: false }),
        })
      );
    });

    it('shouldMaintainZeroSumAfterCommit', async () => {
      // Pre-commit snapshot with non-zero sum blocks commit
      const mockPrisma = buildMockPrisma();
      mockPrisma.balanceSnapshot.findFirst = vi.fn().mockResolvedValue({
        id: 'snap-bad',
        version: 2,
        isCurrent: true,
        balances: [
          { userId: 'u-aisha', netBalance: 10 },  // non-zero sum!
          { userId: 'u-rohan', netBalance: 0 },
        ],
      });
      const service = new CommitImportService(mockPrisma);
      await expect(service.commitSession('sess-approved', 'u-actor')).rejects.toThrow(
        'BALANCE_INTEGRITY_FAILURE'
      );
    });
  });

  // ── End-to-End ────────────────────────────────────────────────────────────

  describe('End-to-End Commit Flow', () => {
    it('shouldCommitApprovedImportSessionSuccessfully', async () => {
      const mockPrisma = buildMockPrisma();
      const service = new CommitImportService(mockPrisma);
      const result = await service.commitSession('sess-approved', 'u-actor');

      // Session locked to COMMITTING first
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImportSessionStatus.COMMITTING }),
        })
      );

      // Expense created for the normalized record
      expect(mockPrisma.expense.create).toHaveBeenCalled();

      // ImportRecord marked IMPORTED
      expect(mockPrisma.importRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'IMPORTED' }),
        })
      );

      // Session marked COMMITTED inside transaction
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImportSessionStatus.COMMITTED }),
        })
      );

      // Result shape is correct
      expect(result.status).toBe(ImportSessionStatus.COMMITTED);
      expect(result.correlationId).toBeDefined();
      expect(result.committedAt).toBeDefined();
    });
  });
});
