import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/AuditService';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { z } from 'zod';
import { ProposalStatus, ImportSessionStatus, AuditActionType } from '@prisma/client';

const ParamSchema = z.object({
  id: z.string().uuid(),
});

const BodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolvedValue: z.string().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawParams = await params;
    const { id } = ParamSchema.parse(rawParams);

    const body = await req.json();
    const { status, resolvedValue } = BodySchema.parse(body);

    const auditRepo = new AuditLogRepository(prisma);
    const auditService = new AuditService(auditRepo);

    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.dataChangeProposal.findUnique({
        where: { id },
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const updated = await tx.dataChangeProposal.update({
        where: { id },
        data: {
          status: status as ProposalStatus,
          resolvedValue: resolvedValue !== undefined ? resolvedValue : proposal.proposedValue,
          approvedById: (session.user as any).id,
          approvedAt: new Date(),
        },
      });

      // Check if all proposals in the session are resolved
      const pendingCount = await tx.dataChangeProposal.count({
        where: {
          sessionId: proposal.sessionId,
          status: 'PENDING',
        },
      });

      if (pendingCount === 0) {
        const importSession = await tx.importSession.findUnique({
          where: { id: proposal.sessionId },
        });

        if (importSession && importSession.status === ImportSessionStatus.REVIEW_REQUIRED) {
          await tx.importSession.update({
            where: { id: proposal.sessionId },
            data: { status: ImportSessionStatus.APPROVED },
          });
        }
      }

      // Log the event in Audit Log
      await auditService.logEvent({
        actorId: (session.user as any).id,
        action: status === 'APPROVED' ? AuditActionType.PROPOSAL_APPROVED : AuditActionType.PROPOSAL_REJECTED,
        entityType: 'PROPOSAL',
        entityId: id,
        beforeState: proposal,
        afterState: updated,
        proposalId: id,
        importSessionId: proposal.sessionId,
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
