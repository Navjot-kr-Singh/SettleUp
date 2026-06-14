import { GroupRepository } from '@/repositories/group.repo';
import { MembershipEventType, AuditActionType } from '@prisma/client';
import { AuditService } from './AuditService';

export class GroupService {
  private repo: GroupRepository;
  private audit: AuditService;

  constructor(repo: GroupRepository, audit: AuditService) {
    this.repo = repo;
    this.audit = audit;
  }

  async createGroup(name: string, actorId: string, correlationId?: string) {
    const existing = await this.repo.findGroupByName(name);
    if (existing) {
      throw new Error(`Group with name '${name}' already exists.`);
    }
    const group = await this.repo.createGroup(name);

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId,
      action: AuditActionType.CREATE_GROUP,
      entityType: 'GROUP',
      entityId: group.id,
      afterState: group,
      correlationId,
    });

    return group;
  }

  async addMember(
    groupId: string,
    userId: string,
    joinedAt: Date = new Date(),
    notes?: string,
    actorId?: string,
    correlationId?: string
  ) {
    const group = await this.repo.findGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    
    await this.repo.addMemberToGroup(groupId, userId, joinedAt);
    
    // Log JOIN history event
    const history = await this.repo.createMembershipHistory(
      groupId,
      userId,
      MembershipEventType.JOIN,
      joinedAt,
      notes || 'Added to group roster.'
    );

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId: actorId || null,
      action: AuditActionType.MEMBER_JOIN,
      entityType: 'MEMBERSHIP',
      entityId: history.id,
      afterState: history,
      correlationId,
      notes: notes || 'Member added to group.',
    });
  }

  async removeMember(
    groupId: string,
    userId: string,
    leftAt: Date = new Date(),
    notes?: string,
    actorId?: string,
    correlationId?: string
  ) {
    const group = await this.repo.findGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    
    await this.repo.removeMemberFromGroup(groupId, userId, leftAt);
    
    // Log LEAVE history event
    const history = await this.repo.createMembershipHistory(
      groupId,
      userId,
      MembershipEventType.LEAVE,
      leftAt,
      notes || 'Removed from group roster.'
    );

    // Auditing (best effort)
    await this.audit.logEvent({
      actorId: actorId || null,
      action: AuditActionType.MEMBER_LEAVE,
      entityType: 'MEMBERSHIP',
      entityId: history.id,
      afterState: history,
      correlationId,
      notes: notes || 'Member removed from group.',
    });
  }

  async getTimeline(groupId: string) {
    const history = await this.repo.getMembershipHistory(groupId);
    return history.map((h) => ({
      userId: h.userId,
      userName: h.user.name,
      role: h.user.role,
      eventType: h.eventType,
      eventDate: h.eventDate,
      notes: h.notes,
    }));
  }
}
