import { PrismaClient, ImportSessionStatus, AnomalySeverity, ProposalStatus, AuditActionType, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { MembershipService } from './membership';
import { ExchangeRateService } from './ExchangeRateService';
import { SplitCalculationService } from './SplitCalculationService';
import { BalanceEngineService } from './BalanceEngineService';
import { AnomalyDetectorEngine } from './import-engine/AnomalyDetectorEngine';
import { RuleEvaluationResult } from './import-engine/AnomalyRule';
import { AuditService } from './AuditService';
import { AuditLogRepository } from '../repositories/audit.repo';

export interface DryRunReport {
  sessionId: string;
  fileName: string;
  status: ImportSessionStatus;
  rowsRead: number;
  rowsValid: number;
  rowsInvalid: number;
  anomaliesFound: number;
  proposalsCount: number;
  balanceImpacts: {
    userId: string;
    userName: string;
    beforeBalance: number;
    afterBalance: number;
    difference: number;
  }[];
}

export function validateStateTransition(
  current: ImportSessionStatus,
  target: ImportSessionStatus
): boolean {
  const allowed: Record<ImportSessionStatus, ImportSessionStatus[]> = {
    PENDING: ['PARSING', 'FAILED'],
    PARSING: ['ANALYZED', 'FAILED'],
    ANALYZED: ['REVIEW_REQUIRED', 'APPROVED', 'FAILED'],
    REVIEW_REQUIRED: ['APPROVED', 'REJECTED', 'FAILED'],
    APPROVED: ['COMMITTING', 'COMMITTED', 'FAILED'],
    COMMITTING: ['COMMITTED', 'FAILED'],
    REJECTED: ['TERMINATED', 'FAILED'],
    COMMITTED: [],
    TERMINATED: [],
    FAILED: [],
    // For compatibility with legacy references
    UPLOADED: ['PARSING', 'FAILED'],
  };
  return allowed[current]?.includes(target) ?? false;
}

export class ImportDryRunService {
  private prisma: PrismaClient;
  private membership: MembershipService;
  private exchangeRate: ExchangeRateService;
  private splitCalc: SplitCalculationService;
  private balanceEngine: BalanceEngineService;
  private detector: AnomalyDetectorEngine;
  private auditService: AuditService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.membership = new MembershipService(prisma);
    this.exchangeRate = new ExchangeRateService(prisma);
    this.splitCalc = new SplitCalculationService();
    this.balanceEngine = new BalanceEngineService(prisma);
    this.detector = new AnomalyDetectorEngine();
    this.auditService = new AuditService(new AuditLogRepository(prisma));
  }

  // Parses raw fields and calculates SHA-256 fingerprint
  calculateFingerprint(dateStr: string, payer: string, amount: string, description: string): string {
    const normDate = dateStr.trim().toLowerCase();
    const normPayer = payer.trim().toLowerCase();
    const normAmount = amount.trim().replace(/,/g, '').toLowerCase();
    const normDesc = description.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    const payload = `${normDate}|${normPayer}|${normAmount}|${normDesc}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // CSV cell parser honoring quoted fields, escaped quotes, commas inside quotes, blank cells, Windows/Unix line endings
  parseCSVContent(content: string): string[][] {
    const lines: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      const next = content[i + 1];

      if (inQuotes) {
        if (c === '"') {
          if (next === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(cell);
          cell = '';
        } else if (c === '\r' || c === '\n') {
          row.push(cell);
          cell = '';
          if (row.some((val) => val.trim() !== '')) {
            lines.push(row);
          }
          row = [];
          if (c === '\r' && next === '\n') {
            i++;
          }
        } else {
          cell += c;
        }
      }
    }

    if (cell !== '' || row.length > 0) {
      row.push(cell);
      if (row.some((val) => val.trim() !== '')) {
        lines.push(row);
      }
    }

    return lines;
  }

  // Strict state transition execution throwing validation errors on failure
  async transitionSessionStatus(
    tx: Prisma.TransactionClient,
    sessionId: string,
    targetStatus: ImportSessionStatus,
    actorId?: string | null
  ) {
    const session = await tx.importSession.findUnique({
      where: { id: sessionId },
      include: {
        anomalies: true,
        proposals: true,
      },
    });

    if (!session) {
      throw new Error('Import session not found');
    }

    const current = session.status;

    // Commit gates preconditions logic checked first
    if (targetStatus === ImportSessionStatus.COMMITTED) {
      if (current !== ImportSessionStatus.APPROVED) {
        throw new Error('Commit rejected: Session status must be APPROVED.');
      }
      const hasErrors = session.anomalies.some((a) => a.severity === AnomalySeverity.ERROR);
      if (hasErrors) {
        throw new Error('Commit rejected: Session contains unresolved ERROR anomalies.');
      }
      const hasPendingProposals = session.proposals.some((p) => p.status === 'PENDING');
      if (hasPendingProposals) {
        throw new Error('Commit rejected: Session contains unresolved proposals.');
      }
      const auditCount = await tx.auditLog.count({
        where: { importSessionId: sessionId },
      });
      if (auditCount === 0) {
        throw new Error('Commit rejected: Audit trail is incomplete.');
      }
    }

    if (!validateStateTransition(current, targetStatus)) {
      throw new Error(`InvalidStateTransition: Cannot transition import session from "${current}" to "${targetStatus}"`);
    }

    const updated = await tx.importSession.update({
      where: { id: sessionId },
      data: { status: targetStatus },
    });

    return updated;
  }

  async importDryRun(
    groupId: string,
    fileName: string,
    csvContent: string,
    actorId?: string | null
  ): Promise<DryRunReport> {
    const fileHash = crypto.createHash('sha256').update(csvContent).digest('hex');

    // 1. Idempotency Check (groupId, fileHash)
    const existingSession = await this.prisma.importSession.findFirst({
      where: { groupId, fileHash },
    });

    if (existingSession) {
      // Create session in PENDING state with null fileHash to bypass unique constraint
      const session = await this.prisma.importSession.create({
        data: {
          groupId,
          fileName,
          fileHash: null,
          status: ImportSessionStatus.PENDING,
        },
      });

      const correlationId = crypto.randomUUID();

      await this.auditService.logEvent({
        actorId,
        action: AuditActionType.IMPORT_START,
        entityType: 'GROUP',
        entityId: groupId,
        importSessionId: session.id,
        correlationId,
        metadata: { fileName },
      });

      // Create duplicate session anomaly
      await this.prisma.importAnomaly.create({
        data: {
          sessionId: session.id,
          rowNumber: 0,
          severity: AnomalySeverity.ERROR,
          type: 'DUPLICATE_IMPORT_SESSION',
          description: `Duplicate session: A file with this exact content has already been imported for group ${groupId}.`,
        },
      });

      await this.prisma.importSession.update({
        where: { id: session.id },
        data: { status: ImportSessionStatus.FAILED },
      });

      await this.auditService.logEvent({
        actorId,
        action: AuditActionType.IMPORT_FAILED,
        entityType: 'IMPORT_SESSION',
        entityId: session.id,
        importSessionId: session.id,
        correlationId,
        notes: `Import failed: DUPLICATE_IMPORT_SESSION.`,
      });

      throw new Error(`DUPLICATE_IMPORT_SESSION: Duplicate file upload detected.`);
    }

    // 2. Normal flow: Create session outside transaction
    const session = await this.prisma.importSession.create({
      data: {
        groupId,
        fileName,
        fileHash,
        status: ImportSessionStatus.PENDING,
      },
    });

    const correlationId = crypto.randomUUID();

    // Create Audit entry for IMPORT_START
    await this.auditService.logEvent({
      actorId,
      action: AuditActionType.IMPORT_START,
      entityType: 'GROUP',
      entityId: groupId,
      importSessionId: session.id,
      correlationId,
    });

    try {
      let finalReport: DryRunReport | null = null;

      // Start Prisma Staging Transaction
      await this.prisma.$transaction(async (tx) => {
        // Transition to PARSING
        await tx.importSession.update({
          where: { id: session.id },
          data: { status: ImportSessionStatus.PARSING },
        });

        const rows = this.parseCSVContent(csvContent);
        if (rows.length === 0) {
          throw new Error('CSV is empty');
        }

        // Validate required headers
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const requiredCols = ['date', 'amount', 'currency', 'description', 'split_type', 'split_with'];
        const payerColIndex = headers.findIndex((h) => h === 'payer' || h === 'paid_by');
        const missingCols = requiredCols.filter((col) => !headers.includes(col));
        if (payerColIndex === -1) {
          missingCols.push('payer');
        }

        if (missingCols.length > 0) {
          for (const col of missingCols) {
            await tx.importAnomaly.create({
              data: {
                sessionId: session.id,
                rowNumber: 0,
                severity: AnomalySeverity.ERROR,
                type: 'MISSING_REQUIRED_COLUMN',
                description: `Missing required header column: "${col}"`,
              },
            });
          }
          throw new Error(`MISSING_REQUIRED_COLUMNS: Missing ${missingCols.join(', ')}`);
        }

        // Audit parse after validating headers & obtaining headers order
        await tx.auditLog.create({
          data: {
            userId: actorId || null,
            action: AuditActionType.IMPORT_PARSE,
            entityType: 'IMPORT_SESSION',
            entityId: session.id,
            correlationId,
            importSessionId: session.id,
            metadata: { headers },
            notes: 'CSV parsing completed.',
          },
        });

        const dataRows = rows.slice(1);
        const stagedRecords = [];

        // Save raw content & fingerprints
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const rowNum = i + 2;

          const dateStr = row[headers.indexOf('date')] || '';
          const descStr = row[headers.indexOf('description')] || '';
          const payerStr = row[payerColIndex] || '';
          const amtStr = row[headers.indexOf('amount')] || '';
          const currencyStr = row[headers.indexOf('currency')] || '';
          const splitTypeStr = row[headers.indexOf('split_type')] || '';
          const splitWithStr = row[headers.indexOf('split_with')] || '';
          const splitDetailsStr = headers.includes('split_details') ? (row[headers.indexOf('split_details')] || '') : '';
          const notesStr = headers.includes('notes') ? (row[headers.indexOf('notes')] || '') : '';

          const fingerprint = this.calculateFingerprint(dateStr, payerStr, amtStr, descStr);

          let parsedAmount: number | null = null;
          const cleanAmt = amtStr.trim().replace(/,/g, '');
          if (cleanAmt && !isNaN(Number(cleanAmt))) {
            parsedAmount = Number(cleanAmt);
          }

          let parsedDate: Date | null = null;
          if (dateStr.trim() !== '') {
            const tryDate = new Date(dateStr.trim());
            if (!isNaN(tryDate.getTime())) {
              parsedDate = tryDate;
            } else {
              const match = dateStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
              if (match) {
                const d = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
                if (!isNaN(d.getTime())) {
                  parsedDate = d;
                }
              }
            }
          }

          const splitWith = splitWithStr.split(';').map((s) => s.trim()).filter(Boolean);

          const record = await tx.importRecord.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawContent: row,
              status: 'PENDING',
              fingerprint,
            },
          });

          stagedRecords.push({
            recordId: record.id,
            rowNumber: rowNum,
            fingerprint,
            date: parsedDate,
            description: descStr,
            paidBy: payerStr,
            amount: parsedAmount,
            currency: currencyStr,
            splitType: splitTypeStr,
            splitWith,
            splitDetails: splitDetailsStr,
            notes: notesStr,
            rawContent: row,
          });
        }

        // Transition to ANALYZED
        await tx.importSession.update({
          where: { id: session.id },
          data: { status: ImportSessionStatus.ANALYZED },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId || null,
            action: AuditActionType.IMPORT_ANALYZE,
            entityType: 'IMPORT_SESSION',
            entityId: session.id,
            correlationId,
            importSessionId: session.id,
            notes: 'Anomaly detection rules started.',
          },
        });

        // Run Anomaly rules evaluation
        const detectorResults = await this.detector.run(groupId, this.membership, stagedRecords, tx);

        let totalAnomalies = 0;
        let totalProposals = 0;

        for (const [rowNum, anomalies] of detectorResults.entries()) {
          const stagedRec = stagedRecords.find((r) => r.rowNumber === rowNum);
          for (const a of anomalies) {
            totalAnomalies++;
            const anomaly = await tx.importAnomaly.create({
              data: {
                sessionId: session.id,
                recordId: stagedRec?.recordId,
                rowNumber: rowNum,
                severity: a.severity,
                type: a.type,
                description: a.description,
              },
            });

            if (a.proposal) {
              totalProposals++;
              const proposal = await tx.dataChangeProposal.create({
                data: {
                  sessionId: session.id,
                  recordId: stagedRec?.recordId,
                  rowNumber: rowNum,
                  field: a.proposal.field,
                  originalValue: a.proposal.originalValue,
                  proposedValue: a.proposal.proposedValue,
                  reason: a.proposal.reason,
                  status: ProposalStatus.PENDING,
                },
              });

              // Create PROPOSAL_CREATED inside transaction
              await tx.auditLog.create({
                data: {
                  userId: actorId || null,
                  action: AuditActionType.PROPOSAL_CREATED,
                  entityType: 'PROPOSAL',
                  entityId: proposal.id,
                  correlationId,
                  importSessionId: session.id,
                  proposalId: proposal.id,
                  beforeState: Prisma.DbNull,
                  afterState: proposal,
                  notes: `Staged proposal generated for row ${rowNum}.`,
                },
              });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            userId: actorId || null,
            action: AuditActionType.IMPORT_PROPOSAL_GENERATION,
            entityType: 'IMPORT_SESSION',
            entityId: session.id,
            correlationId,
            importSessionId: session.id,
            notes: `Proposals generated. Count: ${totalProposals}`,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId || null,
            action: AuditActionType.IMPORT_BALANCE_SIMULATION,
            entityType: 'IMPORT_SESSION',
            entityId: session.id,
            correlationId,
            importSessionId: session.id,
            notes: 'Projected balance impact simulation started.',
          },
        });

        // 4. Simulate balances & Validate zero-sum integrity
        const currentBalances = await this.balanceEngine.getGroupBalances(groupId);

        // Before simulation check
        let beforeSum = new Decimal(0);
        currentBalances.forEach((b) => {
          beforeSum = beforeSum.plus(b.netBalance);
        });
        if (beforeSum.abs().gt(0.01)) {
          throw new Error(`BALANCE_INTEGRITY_FAILURE: Sum of balances before simulation is non-zero: ${beforeSum.toFixed(4)}`);
        }

        const simulatedBalances: Record<string, Decimal> = {};
        const dbUsers = await tx.user.findMany({ select: { id: true, name: true } });
        const getUserByName = (name: string): string | undefined => {
          const lower = name.toLowerCase().trim();
          return dbUsers.find((u) => u.name.toLowerCase() === lower)?.id;
        };

        currentBalances.forEach((b) => {
          simulatedBalances[b.userId] = new Decimal(b.netBalance);
        });

        let validRowsCount = 0;
        let invalidRowsCount = 0;

        for (const r of stagedRecords) {
          const isBlank = r.rawContent.every((c: string) => !c || c.trim() === '');
          if (isBlank) continue;

          const rowAnomalies = detectorResults.get(r.rowNumber) || [];
          const hasBlockingError = rowAnomalies.some((a) => a.severity === AnomalySeverity.ERROR);

          let payerId = getUserByName(r.paidBy);
          let amount = r.amount || 0;
          let currency = r.currency || 'INR';
          let splitType = r.splitType.trim().toUpperCase() || 'EQUAL';
          let splitWithIds = r.splitWith.map((p: string) => getUserByName(p)).filter(Boolean) as string[];

          rowAnomalies.forEach((a) => {
            if (a.proposal) {
              const prop = a.proposal;
              if (prop.field === 'paid_by') payerId = getUserByName(prop.proposedValue);
              if (prop.field === 'amount') amount = Number(prop.proposedValue);
              if (prop.field === 'currency') currency = prop.proposedValue;
              if (prop.field === 'split_type') splitType = prop.proposedValue.trim().toUpperCase();
              if (prop.field === 'split_with') {
                splitWithIds = prop.proposedValue.split(';').map((p: string) => getUserByName(p)).filter(Boolean) as string[];
              }
            }
          });

          // Ensure we have a valid payerId and participants for building the JSON schema
          const fallbackPayerId = payerId || dbUsers[0]?.id;
          const fallbackSplitWithIds = splitWithIds.length > 0 ? splitWithIds : [dbUsers[0]?.id];
          const txDate = r.date || new Date();
          const { convertedAmount, exchangeRate } = await this.exchangeRate.convertToBase(amount, currency, txDate);

          // Build normalizedData object
          let normalizedRec: any;
          if (splitType === 'SETTLEMENT') {
            const receiverId = fallbackSplitWithIds[0] || fallbackPayerId;
            normalizedRec = {
              type: 'SETTLEMENT',
              date: txDate.toISOString(),
              description: r.description,
              paidById: fallbackPayerId,
              amount,
              currency,
              exchangeRate,
              baseCurrencyAmount: convertedAmount.toNumber(),
              splitType,
              participants: [],
              senderId: fallbackPayerId,
              receiverId,
            };
          } else {
            const strategyParticipants = fallbackSplitWithIds.map((pid: string) => ({ userId: pid }));
            const calculatedSplits = this.splitCalc.calculateSplits(convertedAmount, splitType as any, strategyParticipants);
            normalizedRec = {
              type: 'EXPENSE',
              date: txDate.toISOString(),
              description: r.description,
              paidById: fallbackPayerId,
              amount,
              currency,
              exchangeRate,
              baseCurrencyAmount: convertedAmount.toNumber(),
              splitType,
              participants: calculatedSplits.map(s => ({
                userId: s.userId,
                calculatedAmount: s.calculatedAmount.toNumber(),
              })),
            };
          }

          // Save normalizedData to database
          await tx.importRecord.update({
            where: { id: r.recordId },
            data: {
              normalizedData: normalizedRec,
            },
          });

          if (hasBlockingError) {
            invalidRowsCount++;
            continue;
          }

          validRowsCount++;

          if (!payerId) continue;

          if (splitType === 'SETTLEMENT') {
            const receiverId = splitWithIds[0];
            if (receiverId) {
              if (!simulatedBalances[payerId]) simulatedBalances[payerId] = new Decimal(0);
              if (!simulatedBalances[receiverId]) simulatedBalances[receiverId] = new Decimal(0);

              simulatedBalances[payerId] = simulatedBalances[payerId].plus(convertedAmount);
              simulatedBalances[receiverId] = simulatedBalances[receiverId].minus(convertedAmount);
            }
          } else {
            if (!simulatedBalances[payerId]) simulatedBalances[payerId] = new Decimal(0);
            simulatedBalances[payerId] = simulatedBalances[payerId].plus(convertedAmount);

            const strategyParticipants = splitWithIds.map((pid: string) => ({ userId: pid }));
            const calculatedSplits = this.splitCalc.calculateSplits(convertedAmount, splitType as any, strategyParticipants);

            calculatedSplits.forEach((split) => {
              if (!simulatedBalances[split.userId]) simulatedBalances[split.userId] = new Decimal(0);
              simulatedBalances[split.userId] = simulatedBalances[split.userId].minus(split.calculatedAmount);
            });
          }
        }

        // After simulation check
        let afterSum = new Decimal(0);
        for (const val of Object.values(simulatedBalances)) {
          afterSum = afterSum.plus(val);
        }
        if (afterSum.abs().gt(0.01)) {
          throw new Error(`BALANCE_INTEGRITY_FAILURE: Sum of simulated balances is non-zero: ${afterSum.toFixed(4)}`);
        }

        // Final status inside transaction update
        const nextStatus = totalAnomalies > 0
          ? ImportSessionStatus.REVIEW_REQUIRED
          : ImportSessionStatus.APPROVED;

        await tx.importSession.update({
          where: { id: session.id },
          data: { status: nextStatus },
        });

        const balanceImpactList = Object.entries(simulatedBalances).map(([uid, afterDec]) => {
          const user = dbUsers.find((u) => u.id === uid);
          const prevBal = currentBalances.find((b) => b.userId === uid)?.netBalance || 0;
          const diff = afterDec.minus(prevBal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

          return {
            userId: uid,
            userName: user?.name || 'Unknown',
            beforeBalance: prevBal,
            afterBalance: afterDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
            difference: diff,
          };
        });

        finalReport = {
          sessionId: session.id,
          fileName,
          status: nextStatus,
          rowsRead: dataRows.length,
          rowsValid: validRowsCount,
          rowsInvalid: invalidRowsCount,
          anomaliesFound: totalAnomalies,
          proposalsCount: totalProposals,
          balanceImpacts: balanceImpactList,
        };
      }, { maxWait: 15000, timeout: 30000 });

      // Commit successful: status transitions, and IMPORT_COMPLETE is written outside transaction
      const finalSession = await this.prisma.importSession.findUnique({
        where: { id: session.id },
      });

      await this.auditService.logEvent({
        actorId,
        action: AuditActionType.IMPORT_COMPLETE,
        entityType: 'IMPORT_SESSION',
        entityId: session.id,
        importSessionId: session.id,
        correlationId,
        notes: `Import dry-run finished with status: ${finalSession?.status}`,
      });

      return finalReport!;
    } catch (error: any) {
      // Failure Flow: Rollback stage catches error outside transaction
      await this.prisma.importSession.update({
        where: { id: session.id },
        data: { status: ImportSessionStatus.FAILED },
      });

      // If it is a balance integrity failure, persist the anomaly
      if (error.message.includes('BALANCE_INTEGRITY_FAILURE')) {
        await this.prisma.importAnomaly.create({
          data: {
            sessionId: session.id,
            rowNumber: 0,
            severity: AnomalySeverity.ERROR,
            type: 'BALANCE_INTEGRITY_FAILURE',
            description: error.message,
          },
        });
      }

      await this.auditService.logEvent({
        actorId,
        action: AuditActionType.IMPORT_FAILED,
        entityType: 'IMPORT_SESSION',
        entityId: session.id,
        importSessionId: session.id,
        correlationId,
        notes: `Import failed: ${error.message}`,
      });

      throw error;
    }
  }

  // Dynamically reconstruct report from the database staging records and simulate balance impacts
  async reconstructDryRunReport(sessionId: string): Promise<DryRunReport> {
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      include: {
        records: true,
        anomalies: true,
        proposals: true,
      },
    });

    if (!session) {
      throw new Error('Import session not found');
    }

    const parseLog = await this.prisma.auditLog.findFirst({
      where: {
        importSessionId: sessionId,
        action: AuditActionType.IMPORT_PARSE,
      },
    });

    const headers = (parseLog?.metadata as any)?.headers as string[];
    if (!headers) {
      throw new Error('CSV headers metadata not found in audit trail.');
    }

    const currentBalances = await this.balanceEngine.getGroupBalances(session.groupId);
    const simulatedBalances: Record<string, Decimal> = {};
    const dbUsers = await this.prisma.user.findMany({ select: { id: true, name: true } });
    const getUserByName = (name: string): string | undefined => {
      const lower = name.toLowerCase().trim();
      return dbUsers.find((u) => u.name.toLowerCase() === lower)?.id;
    };

    currentBalances.forEach((b) => {
      simulatedBalances[b.userId] = new Decimal(b.netBalance);
    });

    let validRowsCount = 0;
    let invalidRowsCount = 0;

    const anomaliesMap = new Map<number, any[]>();
    session.anomalies.forEach((a) => {
      const list = anomaliesMap.get(a.rowNumber) || [];
      list.push(a);
      anomaliesMap.set(a.rowNumber, list);
    });

    const payerColIndex = headers.findIndex((h) => h === 'payer' || h === 'paid_by');

    for (const r of session.records) {
      const rawContent = r.rawContent as string[];
      const rowAnomalies = anomaliesMap.get(r.rowNumber) || [];
      const hasBlockingError = rowAnomalies.some((a) => a.severity === AnomalySeverity.ERROR);

      if (hasBlockingError) {
        invalidRowsCount++;
        continue;
      }

      validRowsCount++;

      const dateStr = rawContent[headers.indexOf('date')] || '';
      const descStr = rawContent[headers.indexOf('description')] || '';
      const payerStr = rawContent[payerColIndex] || '';
      const amtStr = rawContent[headers.indexOf('amount')] || '';
      const currencyStr = rawContent[headers.indexOf('currency')] || '';
      const splitTypeStr = rawContent[headers.indexOf('split_type')] || '';
      const splitWithStr = rawContent[headers.indexOf('split_with')] || '';
      const splitDetailsStr = headers.includes('split_details') ? (rawContent[headers.indexOf('split_details')] || '') : '';

      let parsedAmount: number | null = null;
      const cleanAmt = amtStr.trim().replace(/,/g, '');
      if (cleanAmt && !isNaN(Number(cleanAmt))) {
        parsedAmount = Number(cleanAmt);
      }

      let parsedDate: Date | null = null;
      if (dateStr.trim() !== '') {
        const tryDate = new Date(dateStr.trim());
        if (!isNaN(tryDate.getTime())) {
          parsedDate = tryDate;
        } else {
          const match = dateStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (match) {
            const d = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
            if (!isNaN(d.getTime())) {
              parsedDate = d;
            }
          }
        }
      }

      const splitWith = splitWithStr.split(';').map((s) => s.trim()).filter(Boolean);

      let payerId = getUserByName(payerStr);
      let amount = parsedAmount || 0;
      let currency = currencyStr || 'INR';
      let splitType = splitTypeStr.trim().toUpperCase() || 'EQUAL';
      let splitWithIds = splitWith.map((p: string) => getUserByName(p)).filter(Boolean) as string[];

      rowAnomalies.forEach((a) => {
        if (a.proposal) {
          const prop = a.proposal;
          if (prop.field === 'paid_by') payerId = getUserByName(prop.proposedValue);
          if (prop.field === 'amount') amount = Number(prop.proposedValue);
          if (prop.field === 'currency') currency = prop.proposedValue;
          if (prop.field === 'split_type') splitType = prop.proposedValue.trim().toUpperCase();
          if (prop.field === 'split_with') {
            splitWithIds = prop.proposedValue.split(';').map((p: string) => getUserByName(p)).filter(Boolean) as string[];
          }
        }
      });

      if (!payerId) continue;

      const isBlank = rawContent.every((c: string) => !c || c.trim() === '');
      if (isBlank) continue;

      const txDate = parsedDate || new Date();
      const { convertedAmount } = await this.exchangeRate.convertToBase(amount, currency, txDate);

      if (splitType === 'SETTLEMENT') {
        const receiverId = splitWithIds[0];
        if (receiverId) {
          if (!simulatedBalances[payerId]) simulatedBalances[payerId] = new Decimal(0);
          if (!simulatedBalances[receiverId]) simulatedBalances[receiverId] = new Decimal(0);

          simulatedBalances[payerId] = simulatedBalances[payerId].plus(convertedAmount);
          simulatedBalances[receiverId] = simulatedBalances[receiverId].minus(convertedAmount);
        }
      } else {
        if (!simulatedBalances[payerId]) simulatedBalances[payerId] = new Decimal(0);
        simulatedBalances[payerId] = simulatedBalances[payerId].plus(convertedAmount);

        const strategyParticipants = splitWithIds.map((pid) => ({ userId: pid }));
        const calculatedSplits = this.splitCalc.calculateSplits(convertedAmount, splitType as any, strategyParticipants);

        calculatedSplits.forEach((split) => {
          if (!simulatedBalances[split.userId]) simulatedBalances[split.userId] = new Decimal(0);
          simulatedBalances[split.userId] = simulatedBalances[split.userId].minus(split.calculatedAmount);
        });
      }
    }

    const balanceImpactList = Object.entries(simulatedBalances).map(([uid, afterDec]) => {
      const user = dbUsers.find((u) => u.id === uid);
      const prevBal = currentBalances.find((b) => b.userId === uid)?.netBalance || 0;
      const diff = afterDec.minus(prevBal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      return {
        userId: uid,
        userName: user?.name || 'Unknown',
        beforeBalance: prevBal,
        afterBalance: afterDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        difference: diff,
      };
    });

    return {
      sessionId: session.id,
      fileName: session.fileName,
      status: session.status,
      rowsRead: session.records.length,
      rowsValid: validRowsCount,
      rowsInvalid: invalidRowsCount,
      anomaliesFound: session.anomalies.length,
      proposalsCount: session.proposals.length,
      balanceImpacts: balanceImpactList,
    };
  }
}
