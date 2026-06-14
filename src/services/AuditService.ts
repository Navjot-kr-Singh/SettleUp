import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditActionType } from '@prisma/client';

export class AuditService {
  private repo: AuditLogRepository;

  constructor(repo: AuditLogRepository) {
    this.repo = repo;
  }

  async logEvent(data: {
    actorId?: string | null;
    action: AuditActionType;
    entityType: string;
    entityId: string;
    beforeState?: any;
    afterState?: any;
    metadata?: any;
    correlationId?: string;
    importSessionId?: string | null;
    proposalId?: string | null;
    notes?: string | null;
  }) {
    try {
      const correlationId = data.correlationId || crypto.randomUUID();

      let changedFields: any = null;
      if (data.beforeState && data.afterState) {
        changedFields = this.calculateDiff(data.beforeState, data.afterState);
      }

      return await this.repo.create({
        userId: data.actorId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        beforeState: data.beforeState ? JSON.parse(JSON.stringify(data.beforeState)) : null,
        afterState: data.afterState ? JSON.parse(JSON.stringify(data.afterState)) : null,
        changedFields,
        metadata: data.metadata || {},
        correlationId,
        importSessionId: data.importSessionId || null,
        proposalId: data.proposalId || null,
        notes: data.notes || null,
      });
    } catch (error) {
      console.error(
        `[AUDIT_FAILURE] Failed to create audit log for action ${data.action} on entity ${data.entityType}/${data.entityId}:`,
        error
      );
      return null;
    }
  }

  async logSystemEvent(data: {
    action: AuditActionType;
    notes: string;
    metadata?: any;
    actorId?: string | null;
    correlationId?: string;
  }) {
    try {
      const correlationId = data.correlationId || crypto.randomUUID();

      return await this.repo.create({
        userId: data.actorId || null,
        action: data.action,
        entityType: 'SYSTEM',
        entityId: 'SYSTEM',
        correlationId,
        metadata: data.metadata || {},
        notes: data.notes,
      });
    } catch (error) {
      console.error(`[AUDIT_FAILURE] Failed to create system audit log for action ${data.action}:`, error);
      return null;
    }
  }

  calculateDiff(before: any, after: any) {
    if (!before || !after) return null;
    const diff: Record<string, { before: any; after: any }> = {};

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      // Skip fields that auto-update or system internals
      if (['createdAt', 'updatedAt', 'deletedAt', 'password'].includes(key)) {
        continue;
      }

      const valBefore = before[key];
      const valAfter = after[key];

      const normalBefore = this.normalizeVal(valBefore);
      const normalAfter = this.normalizeVal(valAfter);

      if (JSON.stringify(normalBefore) !== JSON.stringify(normalAfter)) {
        diff[key] = {
          before: valBefore,
          after: valAfter,
        };
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }

  private normalizeVal(val: any): any {
    if (val === null || val === undefined) return null;
    
    // Date check
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'string' && !isNaN(Date.parse(val)) && val.includes('T')) {
      return new Date(val).toISOString();
    }

    // Decimal.js or Prisma Decimal check
    if (val && typeof val === 'object' && (val.constructor?.name === 'Decimal' || val.d !== undefined)) {
      return val.toString();
    }

    // Nested array or object comparison
    if (typeof val === 'object') {
      return JSON.parse(JSON.stringify(val));
    }

    return val;
  }
}
