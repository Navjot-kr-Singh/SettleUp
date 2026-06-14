import { PrismaClient, AuditActionType, Prisma } from '@prisma/client';

export class AuditLogRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: {
    userId?: string | null;
    action: AuditActionType;
    entityType: string;
    entityId: string;
    beforeState?: any;
    afterState?: any;
    changedFields?: any;
    metadata?: any;
    correlationId: string;
    importSessionId?: string | null;
    proposalId?: string | null;
    notes?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        beforeState: data.beforeState ?? Prisma.DbNull,
        afterState: data.afterState ?? Prisma.DbNull,
        changedFields: data.changedFields ?? Prisma.DbNull,
        metadata: data.metadata ?? Prisma.DbNull,
        correlationId: data.correlationId,
        importSessionId: data.importSessionId || null,
        proposalId: data.proposalId || null,
        notes: data.notes || null,
      },
      include: {
        user: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: true,
        importSession: true,
        proposal: true,
      },
    });
  }

  async list(filters: {
    userId?: string;
    entityId?: string;
    entityType?: string;
    actions?: AuditActionType[];
    startDate?: Date;
    endDate?: Date;
    correlationId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.AuditLogWhereInput = {};

    if (filters.userId) {
      whereClause.userId = filters.userId;
    }
    if (filters.entityId) {
      whereClause.entityId = filters.entityId;
    }
    if (filters.entityType) {
      whereClause.entityType = filters.entityType;
    }
    if (filters.correlationId) {
      whereClause.correlationId = filters.correlationId;
    }
    if (filters.actions && filters.actions.length > 0) {
      whereClause.action = { in: filters.actions };
    }
    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }
    if (filters.search) {
      whereClause.OR = [
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: {
          user: true,
        },
      }),
      this.prisma.auditLog.count({
        where: whereClause,
      }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
