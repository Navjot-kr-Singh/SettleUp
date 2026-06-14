import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { ImportSessionStatus, AnomalySeverity, AuditActionType } from '@prisma/client';
import {
  ImportDryRunService,
  validateStateTransition,
} from '../../services/ImportDryRunService';
import { AnomalyDetectorEngine } from '../../services/import-engine/AnomalyDetectorEngine';
import { DuplicateRecordDetector } from '../../services/import-engine/rules/DuplicateRecordDetector';
import { ConflictingDuplicateDetector } from '../../services/import-engine/rules/ConflictingDuplicateDetector';
import { PercentageSumDetector } from '../../services/import-engine/rules/PercentageSumDetector';
import { RuleContext } from '../../services/import-engine/AnomalyRule';
import { MissingPayerDetector } from '../../services/import-engine/rules/MissingPayerDetector';
import { MissingParticipantDetector } from '../../services/import-engine/rules/MissingParticipantDetector';
import { InvalidDateDetector } from '../../services/import-engine/rules/InvalidDateDetector';
import { AmbiguousDateDetector } from '../../services/import-engine/rules/AmbiguousDateDetector';
import { InvalidAmountDetector } from '../../services/import-engine/rules/InvalidAmountDetector';
import { NegativeAmountDetector } from '../../services/import-engine/rules/NegativeAmountDetector';
import { MissingCurrencyDetector } from '../../services/import-engine/rules/MissingCurrencyDetector';
import { InvalidCurrencyDetector } from '../../services/import-engine/rules/InvalidCurrencyDetector';
import { SettlementAsExpenseDetector } from '../../services/import-engine/rules/SettlementAsExpenseDetector';
import { UnknownUserDetector } from '../../services/import-engine/rules/UnknownUserDetector';
import { MembershipViolationDetector } from '../../services/import-engine/rules/MembershipViolationDetector';
import { ShareAllocationDetector } from '../../services/import-engine/rules/ShareAllocationDetector';
import { BlankRowDetector } from '../../services/import-engine/rules/BlankRowDetector';

describe('SettleUp Import Engine & Data Governance Suite', () => {
  describe('Import Session State Machine Validation', () => {
    it('shouldRejectInvalidImportStateTransition', () => {
      // Valid transitions
      expect(validateStateTransition(ImportSessionStatus.PENDING, ImportSessionStatus.PARSING)).toBe(true);
      expect(validateStateTransition(ImportSessionStatus.PARSING, ImportSessionStatus.ANALYZED)).toBe(true);
      expect(validateStateTransition(ImportSessionStatus.ANALYZED, ImportSessionStatus.REVIEW_REQUIRED)).toBe(true);
      expect(validateStateTransition(ImportSessionStatus.REVIEW_REQUIRED, ImportSessionStatus.APPROVED)).toBe(true);
      expect(validateStateTransition(ImportSessionStatus.APPROVED, ImportSessionStatus.COMMITTED)).toBe(true);

      // Invalid transitions
      expect(validateStateTransition(ImportSessionStatus.PENDING, ImportSessionStatus.COMMITTED)).toBe(false);
      expect(validateStateTransition(ImportSessionStatus.COMMITTED, ImportSessionStatus.PARSING)).toBe(false);
      expect(validateStateTransition(ImportSessionStatus.REVIEW_REQUIRED, ImportSessionStatus.PARSING)).toBe(false);
      expect(validateStateTransition(ImportSessionStatus.FAILED, ImportSessionStatus.COMMITTED)).toBe(false);
    });

    it('shouldValidateStateTransitionsThoroughly', () => {
      const states = [
        ImportSessionStatus.PENDING,
        ImportSessionStatus.PARSING,
        ImportSessionStatus.ANALYZED,
        ImportSessionStatus.REVIEW_REQUIRED,
        ImportSessionStatus.APPROVED,
        ImportSessionStatus.REJECTED,
        ImportSessionStatus.COMMITTED,
        ImportSessionStatus.TERMINATED,
        ImportSessionStatus.FAILED,
      ];

      for (const current of states) {
        for (const target of states) {
          const valid = validateStateTransition(current, target);
          if (current === ImportSessionStatus.PENDING) {
            if (target === ImportSessionStatus.PARSING || target === ImportSessionStatus.FAILED) {
              expect(valid).toBe(true);
            } else {
              expect(valid).toBe(false);
            }
          }
          if (current === ImportSessionStatus.COMMITTED || current === ImportSessionStatus.TERMINATED || current === ImportSessionStatus.FAILED) {
            expect(valid).toBe(false); // terminal states
          }
        }
      }
    });

    it('shouldThrowErrorOnForbiddenTransitions', async () => {
      const mockPrismaTx: any = {
        importSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-1',
            status: ImportSessionStatus.COMMITTED,
            anomalies: [],
            proposals: [],
          }),
        },
      };

      const service = new ImportDryRunService(mockPrismaTx);

      await expect(
        service.transitionSessionStatus(mockPrismaTx, 'sess-1', ImportSessionStatus.PARSING, 'u-1')
      ).rejects.toThrow('InvalidStateTransition');
    });
  });

  describe('Anomaly Detector Engine & Rules Execution', () => {
    it('shouldExecuteAllRegisteredAnomalyDetectors', async () => {
      const engine = new AnomalyDetectorEngine();
      const mockPrismaTx: any = {
        user: { findMany: vi.fn().mockResolvedValue([]) },
        currency: { findUnique: vi.fn().mockResolvedValue({ code: 'INR' }) },
      };
      const mockMembershipService: any = {};

      const rawRecords: RuleContext['allRawRecords'] = [
        {
          rowNumber: 2,
          fingerprint: 'fp-1',
          date: null,
          description: 'Rent',
          paidBy: '',
          amount: -100,
          currency: '',
          splitType: 'percentage',
          splitWith: [],
          splitDetails: 'Aisha 50%; Rohan 40%',
          notes: '',
          rawContent: ['', 'Rent', '', '-100', '', 'percentage', '', 'Aisha 50%; Rohan 40%', ''],
        },
      ];

      const results = await engine.run('g-1', mockMembershipService, rawRecords, mockPrismaTx);
      const rowAnomalies = results.get(2);

      expect(rowAnomalies).toBeDefined();
      expect(rowAnomalies!.length).toBeGreaterThanOrEqual(5);

      // Verify specific detector triggers
      expect(rowAnomalies!.some((a) => a.type === 'INVALID_DATE')).toBe(true);
      expect(rowAnomalies!.some((a) => a.type === 'MISSING_PAYER')).toBe(true);
      expect(rowAnomalies!.some((a) => a.type === 'NEGATIVE_AMOUNT')).toBe(true);
      expect(rowAnomalies!.some((a) => a.type === 'MISSING_CURRENCY')).toBe(true);
      expect(rowAnomalies!.some((a) => a.type === 'MISSING_PARTICIPANTS')).toBe(true);
      expect(rowAnomalies!.some((a) => a.type === 'PERCENTAGE_SUM_ERROR')).toBe(true);
    });
  });

  describe('Import Identity Hashing Strategy (Fingerprinting)', () => {
    let mockPrismaTx: any;
    let mockMembershipService: any;
    let duplicateDetector: DuplicateRecordDetector;
    let conflictingDetector: ConflictingDuplicateDetector;
    let dryRunService: ImportDryRunService;

    beforeEach(() => {
      mockPrismaTx = {};
      mockMembershipService = {};
      duplicateDetector = new DuplicateRecordDetector();
      conflictingDetector = new ConflictingDuplicateDetector();
      dryRunService = new ImportDryRunService(null as any);
    });

    it('shouldGenerateIdenticalFingerprintForSameNormalizedRow', () => {
      const fp1 = dryRunService.calculateFingerprint('08-02-2026', 'Dev', '3,200', 'Dinner at Marina Bites');
      const fp2 = dryRunService.calculateFingerprint(' 08-02-2026 ', 'dev', '3200', 'Dinner at Marina Bites.');
      expect(fp1).toBe(fp2);
    });

    it('shouldGenerateDifferentFingerprintsForDifferentFields', () => {
      const base = dryRunService.calculateFingerprint('08-02-2026', 'Dev', '3200', 'Dinner');
      const diffAmount = dryRunService.calculateFingerprint('08-02-2026', 'Dev', '3250', 'Dinner');
      const diffPayer = dryRunService.calculateFingerprint('08-02-2026', 'Aisha', '3200', 'Dinner');
      const diffDesc = dryRunService.calculateFingerprint('08-02-2026', 'Dev', '3200', 'Lunch');

      expect(base).not.toBe(diffAmount);
      expect(base).not.toBe(diffPayer);
      expect(base).not.toBe(diffDesc);
    });

    it('shouldDetectDuplicateUsingFingerprint', async () => {
      const fp = dryRunService.calculateFingerprint('08-02-2026', 'Dev', '3200', 'Dinner');
      const records: RuleContext['allRawRecords'] = [
        {
          rowNumber: 2,
          fingerprint: fp,
          date: new Date('2026-02-08'),
          description: 'Dinner at Marina Bites',
          paidBy: 'Dev',
          amount: 3200,
          currency: 'INR',
          splitType: 'equal',
          splitWith: ['Aisha', 'Rohan'],
          splitDetails: '',
          notes: '',
          rawContent: ['08-02-2026', 'Dinner at Marina Bites', 'Dev', '3200', 'INR', 'equal', 'Aisha;Rohan', '', ''],
        },
        {
          rowNumber: 3,
          fingerprint: fp,
          date: new Date('2026-02-08'),
          description: 'dinner - marina bites',
          paidBy: 'Dev',
          amount: 3200,
          currency: 'INR',
          splitType: 'equal',
          splitWith: ['Aisha', 'Rohan'],
          splitDetails: '',
          notes: '',
          rawContent: ['08-02-2026', 'dinner - marina bites', 'Dev', '3200', 'INR', 'equal', 'Aisha;Rohan', '', ''],
        },
      ];

      const context: RuleContext = {
        prisma: mockPrismaTx,
        groupId: 'g-1',
        membershipService: mockMembershipService,
        allRawRecords: records,
      };

      const resRow2 = await duplicateDetector.evaluate(records[0], context);
      expect(resRow2.length).toBe(0);

      const resRow3 = await duplicateDetector.evaluate(records[1], context);
      expect(resRow3.length).toBe(1);
      expect(resRow3[0].type).toBe('DUPLICATE_RECORD');
    });

    it('shouldDetectConflictingDuplicateUsingDetector', async () => {
      const records: RuleContext['allRawRecords'] = [
        {
          rowNumber: 2,
          fingerprint: 'fp-1',
          date: new Date('2026-02-08'),
          description: 'Dinner at Marina Bites',
          paidBy: 'Dev',
          amount: 3200,
          currency: 'INR',
          splitType: 'equal',
          splitWith: ['Aisha', 'Rohan'],
          splitDetails: '',
          notes: '',
          rawContent: ['08-02-2026', 'Dinner at Marina Bites', 'Dev', '3200', 'INR', 'equal', 'Aisha;Rohan', '', ''],
        },
        {
          rowNumber: 3,
          fingerprint: 'fp-2',
          date: new Date('2026-02-08'),
          description: 'Dinner at Marina Bites',
          paidBy: 'Aisha',
          amount: 3500,
          currency: 'INR',
          splitType: 'equal',
          splitWith: ['Aisha', 'Rohan'],
          splitDetails: '',
          notes: '',
          rawContent: ['08-02-2026', 'Dinner at Marina Bites', 'Aisha', '3500', 'INR', 'equal', 'Aisha;Rohan', '', ''],
        },
      ];

      const context: RuleContext = {
        prisma: mockPrismaTx,
        groupId: 'g-1',
        membershipService: mockMembershipService,
        allRawRecords: records,
      };

      const resRow2 = await conflictingDetector.evaluate(records[0], context);
      expect(resRow2.length).toBe(0);

      const resRow3 = await conflictingDetector.evaluate(records[1], context);
      expect(resRow3.length).toBe(1);
      expect(resRow3[0].type).toBe('CONFLICTING_DUPLICATE');
      expect(resRow3[0].proposal?.proposedValue).toBe('REJECTED');
    });
  });


  describe('Dry-Run Simulation & Balance Integrity Verification', () => {
    let mockPrisma: any;
    let dryRunService: ImportDryRunService;

    beforeEach(() => {
      mockPrisma = {
        importSession: {
          create: vi.fn().mockResolvedValue({ id: 'sess-1' }),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue({ id: 'sess-1', status: 'APPROVED', anomalies: [], proposals: [] }),
        },
        importRecord: {
          create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          update: vi.fn(),
        },
        importAnomaly: { create: vi.fn() },
        dataChangeProposal: { create: vi.fn() },
        auditLog: { create: vi.fn() },
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u-aisha', name: 'Aisha', role: 'MEMBER' },
            { id: 'u-rohan', name: 'Rohan', role: 'MEMBER' },
          ]),
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const list = [
              { id: 'u-aisha', name: 'Aisha', role: 'MEMBER' },
              { id: 'u-rohan', name: 'Rohan', role: 'MEMBER' },
            ];
            return list.find((u) => u.id === where.id || u.name === where.name) || null;
          }),
        },
        currency: {
          findUnique: vi.fn().mockResolvedValue({ code: 'INR' }),
        },
        exchangeRate: {
          findFirst: vi.fn().mockResolvedValue({ rate: new Decimal(1.0) }),
        },
        groupMembership: {
          findUnique: vi.fn().mockResolvedValue({ joinedAt: new Date('2026-01-01'), leftAt: null }),
        },
        balanceSnapshot: {
          findFirst: vi.fn().mockResolvedValue({
            balances: [
              { userId: 'u-aisha', netBalance: 0 },
              { userId: 'u-rohan', netBalance: 0 },
            ],
          }),
        },
        $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      };

      dryRunService = new ImportDryRunService(mockPrisma as any);
    });

    it('shouldMaintainZeroSumAfterDryRunSimulation', async () => {
      const csvContent =
        'date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n' +
        '15-02-2026,Pizza,Aisha,100,INR,equal,Aisha;Rohan,,';

      const report = await dryRunService.importDryRun('g-1', 'test.csv', csvContent);

      expect(report.status).toBe(ImportSessionStatus.APPROVED);
      expect(report.rowsRead).toBe(1);

      const aishaImpact = report.balanceImpacts.find((b) => b.userId === 'u-aisha');
      const rohanImpact = report.balanceImpacts.find((b) => b.userId === 'u-rohan');

      expect(aishaImpact?.afterBalance).toBe(50);
      expect(rohanImpact?.afterBalance).toBe(-50);

      const sum = aishaImpact!.afterBalance + rohanImpact!.afterBalance;
      expect(sum).toBe(0);
    });

    it('shouldRejectDryRunSimulationIfZeroSumFails', async () => {
      // Force non-zero sum balance before simulation starts
      mockPrisma.balanceSnapshot.findFirst.mockResolvedValueOnce({
        balances: [
          { userId: 'u-aisha', netBalance: 10 },
          { userId: 'u-rohan', netBalance: 0 },
        ],
      });

      const csvContent =
        'date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n' +
        '15-02-2026,Pizza,Aisha,100,INR,equal,Aisha;Rohan,,';

      await expect(
        dryRunService.importDryRun('g-1', 'test.csv', csvContent)
      ).rejects.toThrow('BALANCE_INTEGRITY_FAILURE');

      expect(mockPrisma.importAnomaly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BALANCE_INTEGRITY_FAILURE',
        }),
      });
    });
  });

  describe('Dry-Run Isolation (No Production Writes)', () => {
    let mockPrisma: any;
    let dryRunService: ImportDryRunService;

    beforeEach(() => {
      mockPrisma = {
        importSession: {
          create: vi.fn().mockResolvedValue({ id: 'sess-1' }),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue({ id: 'sess-1', status: 'APPROVED', anomalies: [], proposals: [] }),
        },
        importRecord: {
          create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          update: vi.fn(),
        },
        importAnomaly: { create: vi.fn() },
        dataChangeProposal: { create: vi.fn() },
        auditLog: { create: vi.fn() },
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: 'u-aisha', name: 'Aisha' }]),
          findUnique: vi.fn().mockResolvedValue({ id: 'u-aisha', name: 'Aisha' }),
        },
        currency: { findUnique: vi.fn().mockResolvedValue({ code: 'INR' }) },
        exchangeRate: { findFirst: vi.fn().mockResolvedValue({ rate: new Decimal(1.0) }) },
        groupMembership: { findUnique: vi.fn().mockResolvedValue({ joinedAt: new Date('2026-01-01') }) },
        balanceSnapshot: {
          findFirst: vi.fn().mockResolvedValue({
            balances: [{ userId: 'u-aisha', netBalance: 0 }],
          }),
          create: vi.fn(),
          update: vi.fn(),
        },
        // Core financial tables have spy methods that verify they are never called
        expense: {
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        expenseParticipant: {
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        settlement: {
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      };

      dryRunService = new ImportDryRunService(mockPrisma as any);
    });

    it('shouldNeverWriteToProductionFinancialTablesDuringDryRun', async () => {
      const csvContent =
        'date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n' +
        '15-02-2026,Pizza,Aisha,100,INR,equal,Aisha,,';

      await dryRunService.importDryRun('g-1', 'test.csv', csvContent);

      // Verify no database writes were triggered on production ledger
      expect(mockPrisma.expense.create).not.toHaveBeenCalled();
      expect(mockPrisma.expense.update).not.toHaveBeenCalled();
      expect(mockPrisma.expenseParticipant.create).not.toHaveBeenCalled();
      expect(mockPrisma.settlement.create).not.toHaveBeenCalled();
      expect(mockPrisma.settlement.update).not.toHaveBeenCalled();
      expect(mockPrisma.balanceSnapshot.create).not.toHaveBeenCalled();
      expect(mockPrisma.balanceSnapshot.update).not.toHaveBeenCalled();
    });
  });

  describe('Failure Survivability & Rollback Safety', () => {
    let mockPrisma: any;
    let dryRunService: ImportDryRunService;

    beforeEach(() => {
      mockPrisma = {
        importSession: {
          create: vi.fn().mockResolvedValue({ id: 'sess-failed-1' }),
          update: vi.fn().mockResolvedValue({ id: 'sess-failed-1', status: 'FAILED' }),
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue({ id: 'sess-failed-1', status: 'FAILED', anomalies: [], proposals: [] }),
        },
        importRecord: { create: vi.fn() },
        importAnomaly: { create: vi.fn() },
        dataChangeProposal: { create: vi.fn() },
        auditLog: { create: vi.fn() },
        user: { findMany: vi.fn().mockResolvedValue([]) },
        currency: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async () => {
          // Force transaction rollback on database constraint warning or anomaly trigger
          throw new Error('Forced transaction rollback error');
        }),
      };
      dryRunService = new ImportDryRunService(mockPrisma as any);
    });

    it('shouldSurviveTransactionFailureAndRecordFailedStatus', async () => {
      const csvContent =
        'date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n' +
        '15-02-2026,Pizza,Aisha,100,INR,equal,Aisha,,';

      await expect(
        dryRunService.importDryRun('g-1', 'test.csv', csvContent)
      ).rejects.toThrow('Forced transaction rollback error');

      // Assert that session creation was run, and fallback update sets status to FAILED
      expect(mockPrisma.importSession.create).toHaveBeenCalled();
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith({
        where: { id: 'sess-failed-1' },
        data: { status: ImportSessionStatus.FAILED },
      });

      // Assert that staging inserts inside transaction rolled back (Prisma handles transaction rollback automatically, 
      // but let's confirm staging creation methods inside the transaction were never run outside it).
      expect(mockPrisma.importRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.importAnomaly.create).not.toHaveBeenCalled();
      expect(mockPrisma.dataChangeProposal.create).not.toHaveBeenCalled();

      // Assert that IMPORT_FAILED audit log exists
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditActionType.IMPORT_FAILED,
          }),
        })
      );
    });
  });

  describe('SHA-256 Idempotency Protection', () => {
    let mockPrisma: any;
    let dryRunService: ImportDryRunService;

    beforeEach(() => {
      mockPrisma = {
        importSession: {
          create: vi.fn().mockResolvedValue({ id: 'sess-dup' }),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ id: 'sess-existing', fileHash: 'hash-abc' }),
          findUnique: vi.fn().mockResolvedValue({ id: 'sess-dup', status: 'FAILED', anomalies: [], proposals: [] }),
        },
        importAnomaly: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      dryRunService = new ImportDryRunService(mockPrisma as any);
    });

    it('shouldBlockDuplicateUploadsInSameGroup', async () => {
      const csvContent = 'date,description,paid_by,amount,currency,split_type,split_with\n15-02-2026,Rent,Aisha,100,INR,equal,Aisha';
      
      await expect(
        dryRunService.importDryRun('g-1', 'test.csv', csvContent)
      ).rejects.toThrow('DUPLICATE_IMPORT_SESSION');

      expect(mockPrisma.importAnomaly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DUPLICATE_IMPORT_SESSION',
        }),
      });
      expect(mockPrisma.importSession.update).toHaveBeenCalledWith({
        where: { id: 'sess-dup' },
        data: { status: ImportSessionStatus.FAILED },
      });
    });
  });

  describe('Import Session Header Validation', () => {
    it('shouldGenerateAnomalyOnRow0IfRequiredHeaderIsMissing', async () => {
      const mockPrisma = {
        importSession: {
          create: vi.fn().mockResolvedValue({ id: 'sess-header-err' }),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        importAnomaly: {
          create: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
        $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      };

      const dryRunService = new ImportDryRunService(mockPrisma as any);
      // Missing required header: date
      const csvContent = 'payer,amount,currency,description,split_type,split_with\nAisha,100,INR,Rent,equal,Aisha';

      await expect(
        dryRunService.importDryRun('g-1', 'test.csv', csvContent)
      ).rejects.toThrow('MISSING_REQUIRED_COLUMNS');

      expect(mockPrisma.importAnomaly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rowNumber: 0,
          type: 'MISSING_REQUIRED_COLUMN',
          severity: AnomalySeverity.ERROR,
        }),
      });
    });
  });

  describe('Commit Preconditions Gate Validation', () => {
    it('shouldRejectCommitIfSessionNotApproved', async () => {
      const mockPrismaTx: any = {
        importSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-1',
            status: ImportSessionStatus.REVIEW_REQUIRED,
            anomalies: [],
            proposals: [],
          }),
        },
      };

      const service = new ImportDryRunService(mockPrismaTx);

      await expect(
        service.transitionSessionStatus(mockPrismaTx, 'sess-1', ImportSessionStatus.COMMITTED, 'u-1')
      ).rejects.toThrow('Commit rejected: Session status must be APPROVED.');
    });

    it('shouldRejectCommitIfSessionContainsErrors', async () => {
      const mockPrismaTx: any = {
        importSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-1',
            status: ImportSessionStatus.APPROVED,
            anomalies: [{ severity: AnomalySeverity.ERROR }],
            proposals: [],
          }),
        },
      };

      const service = new ImportDryRunService(mockPrismaTx);

      await expect(
        service.transitionSessionStatus(mockPrismaTx, 'sess-1', ImportSessionStatus.COMMITTED, 'u-1')
      ).rejects.toThrow('Commit rejected: Session contains unresolved ERROR anomalies.');
    });
  });

  describe('Rule Detectors in Isolation', () => {
    let mockPrisma: any;
    let mockMembership: any;
    let context: RuleContext;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u-aisha', name: 'Aisha', role: 'MEMBER' },
            { id: 'u-rohan', name: 'Rohan', role: 'MEMBER' },
            { id: 'u-kabir', name: 'Kabir', role: 'GUEST' },
          ]),
        },
        currency: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (['INR', 'USD'].includes(where.code)) return { code: where.code };
            return null;
          }),
        },
      };
      mockMembership = {
        isUserActiveOnDate: vi.fn().mockResolvedValue(true),
      };
      context = {
        prisma: mockPrisma,
        groupId: 'g-1',
        membershipService: mockMembership,
        allRawRecords: [],
      };
    });

    it('shouldDetectMissingPayer', async () => {
      const detector = new MissingPayerDetector();
      const rec = { rowNumber: 10, paidBy: '', rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('MISSING_PAYER');
    });

    it('shouldDetectMissingParticipants', async () => {
      const detector = new MissingParticipantDetector();
      const rec = { rowNumber: 11, splitWith: [], rawContent: ['15-02-2026', 'Rent', 'Aisha', '100', 'INR', 'equal', ''] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('MISSING_PARTICIPANTS');
    });

    it('shouldDetectInvalidDate', async () => {
      const detector = new InvalidDateDetector();
      const rec = { rowNumber: 12, date: null, rawContent: ['InvalidDateString'] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('INVALID_DATE');
    });

    it('shouldDetectAmbiguousDate', async () => {
      const detector = new AmbiguousDateDetector();
      const rec = { rowNumber: 13, rawContent: ['04-05-2026'] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('AMBIGUOUS_DATE');
    });

    it('shouldDetectInvalidAmount', async () => {
      const detector = new InvalidAmountDetector();
      const rec = { rowNumber: 14, amount: null, rawContent: ['abc'] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('INVALID_AMOUNT');
    });

    it('shouldDetectNegativeAmount', async () => {
      const detector = new NegativeAmountDetector();
      const rec = { rowNumber: 15, amount: -30, rawContent: ['-30'] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('NEGATIVE_AMOUNT');
    });

    it('shouldDetectZeroAmount', async () => {
      const detector = new InvalidAmountDetector();
      const rec = { rowNumber: 16, amount: 0, rawContent: ['0'] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('ZERO_AMOUNT');
    });

    it('shouldDetectMissingCurrency', async () => {
      const detector = new MissingCurrencyDetector();
      const rec = { rowNumber: 17, currency: '', rawContent: ['15-02-2026', 'Rent', 'Aisha', '100', ''] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('MISSING_CURRENCY');
    });

    it('shouldDetectInvalidCurrency', async () => {
      const detector = new InvalidCurrencyDetector();
      const rec = { rowNumber: 18, currency: 'XYZ', rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('INVALID_CURRENCY');
    });

    it('shouldDetectSettlementAsExpense', async () => {
      const detector = new SettlementAsExpenseDetector();
      const rec = { rowNumber: 19, description: 'Rohan Repaid Aisha', notes: '', splitType: 'equal', rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('SETTLEMENT_STORED_AS_EXPENSE');
    });

    it('shouldDetectUnknownUser_Payer', async () => {
      const detector = new UnknownUserDetector();
      const rec = { rowNumber: 20, paidBy: 'UnknownPerson', splitWith: [], rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('UNKNOWN_USER');
    });

    it('shouldDetectUnknownUser_Participant', async () => {
      const detector = new UnknownUserDetector();
      const rec = { rowNumber: 21, paidBy: 'Aisha', splitWith: ['Stranger'], rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('UNKNOWN_USER');
    });

    it('shouldNormalizeUserCasing', async () => {
      const detector = new UnknownUserDetector();
      const rec = { rowNumber: 22, paidBy: 'aisha', splitWith: [], rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('USER_MAPPING_REQUIRED');
      expect(res[0].proposal?.proposedValue).toBe('Aisha');
    });

    it('shouldDetectPercentageSumError', async () => {
      const detector = new PercentageSumDetector();
      const rec = { rowNumber: 23, splitType: 'percentage', splitDetails: 'Aisha 40%; Rohan 70%', rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('PERCENTAGE_SUM_ERROR');
    });

    it('shouldDetectShareAllocationError', async () => {
      const detector = new ShareAllocationDetector();
      const rec = { rowNumber: 24, splitType: 'shares', splitDetails: '', splitWith: ['Aisha'], rawContent: [] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('SHARE_ALLOCATION_ERROR');
    });

    it('shouldDetectBlankRow', async () => {
      const detector = new BlankRowDetector();
      const rec = { rowNumber: 25, rawContent: ['', '', ''] } as any;
      const res = await detector.evaluate(rec, context);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('BLANK_RECORD');
    });
  });
});
