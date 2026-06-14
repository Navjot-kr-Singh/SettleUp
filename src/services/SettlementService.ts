import { SettlementRepository } from '@/repositories/settlement.repo';
import { ExchangeRateService } from './ExchangeRateService';
import { MembershipService } from './membership';
import { AuditService } from './AuditService';
import { BalanceEngineService } from './BalanceEngineService';
import { Decimal } from 'decimal.js';
import { AuditActionType } from '@prisma/client';

export class SettlementService {
  private repo: SettlementRepository;
  private exchangeRate: ExchangeRateService;
  private membership: MembershipService;
  private audit: AuditService;
  private balanceEngine: BalanceEngineService;

  constructor(
    repo: SettlementRepository,
    exchangeRate: ExchangeRateService,
    membership: MembershipService,
    audit: AuditService,
    balanceEngine: BalanceEngineService
  ) {
    this.repo = repo;
    this.exchangeRate = exchangeRate;
    this.membership = membership;
    this.audit = audit;
    this.balanceEngine = balanceEngine;
  }

  async createSettlement(
    data: {
      groupId: string;
      senderId: string;
      receiverId: string;
      amount: number | string;
      currency: string;
      date: Date;
      notes?: string;
    },
    actorId: string,
    correlationId?: string
  ) {
    if (data.senderId === data.receiverId) {
      throw new Error('Sender and Receiver of a settlement cannot be the same user.');
    }

    // Validate active memberships dynamically from the database
    const isSenderActive = await this.membership.isUserActiveOnDate(data.groupId, data.senderId, data.date);
    if (!isSenderActive) {
      throw new Error(`Sender is not active in the group on date ${data.date.toISOString()}`);
    }

    const isReceiverActive = await this.membership.isUserActiveOnDate(data.groupId, data.receiverId, data.date);
    if (!isReceiverActive) {
      throw new Error(`Receiver is not active in the group on date ${data.date.toISOString()}`);
    }

    // Convert to base INR currency
    const { convertedAmount, exchangeRate } = await this.exchangeRate.convertToBase(
      data.amount,
      data.currency,
      data.date
    );

    const settlement = await this.repo.createSettlement({
      groupId: data.groupId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      amount: new Decimal(data.amount),
      currency: data.currency,
      exchangeRate,
      baseCurrencyAmount: convertedAmount,
      date: data.date,
      notes: data.notes,
    });

    // Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(data.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on createSettlement:', err);
    }

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.CREATE_SETTLEMENT,
      entityType: 'SETTLEMENT',
      entityId: settlement.id,
      afterState: settlement,
      correlationId,
    });

    return settlement;
  }

  async getSettlementDetails(id: string) {
    const settlement = await this.repo.findSettlementById(id);
    if (!settlement) {
      throw new Error('Settlement not found');
    }
    return settlement;
  }

  async listSettlements(groupId: string) {
    return this.repo.listSettlements(groupId);
  }

  async updateSettlement(
    id: string,
    data: {
      amount: number | string;
      currency: string;
      date: Date;
      notes?: string;
    },
    actorId: string,
    correlationId?: string
  ) {
    const beforeState = await this.repo.findSettlementById(id);
    if (!beforeState) {
      throw new Error('Settlement not found');
    }

    const isSenderActive = await this.membership.isUserActiveOnDate(beforeState.groupId, beforeState.senderId, data.date);
    if (!isSenderActive) {
      throw new Error(`Sender is not active in the group on date ${data.date.toISOString()}`);
    }

    const isReceiverActive = await this.membership.isUserActiveOnDate(beforeState.groupId, beforeState.receiverId, data.date);
    if (!isReceiverActive) {
      throw new Error(`Receiver is not active in the group on date ${data.date.toISOString()}`);
    }

    const { convertedAmount, exchangeRate } = await this.exchangeRate.convertToBase(
      data.amount,
      data.currency,
      data.date
    );

    const updated = await this.repo.updateSettlement(id, {
      amount: new Decimal(data.amount),
      currency: data.currency,
      exchangeRate,
      baseCurrencyAmount: convertedAmount,
      date: data.date,
      notes: data.notes,
    });

    // Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(beforeState.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on updateSettlement:', err);
    }

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.UPDATE_SETTLEMENT,
      entityType: 'SETTLEMENT',
      entityId: id,
      beforeState,
      afterState: updated,
      correlationId,
    });

    return updated;
  }

  async deleteSettlement(id: string, actorId: string, correlationId?: string) {
    const beforeState = await this.repo.findSettlementById(id);
    if (!beforeState) {
      throw new Error('Settlement not found');
    }

    const deleted = await this.repo.deleteSettlement(id);

    // Rebuild Balance Snapshot (best effort)
    try {
      await this.balanceEngine.rebuildSnapshot(beforeState.groupId);
    } catch (err) {
      console.error('[CACHE_FAILURE] Failed to rebuild balance snapshot on deleteSettlement:', err);
    }

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.DELETE_SETTLEMENT,
      entityType: 'SETTLEMENT',
      entityId: id,
      beforeState,
      afterState: deleted,
      correlationId,
    });

    return deleted;
  }
}
