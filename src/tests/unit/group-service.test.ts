import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupService } from '../../services/group';
import { GroupRepository } from '../../repositories/group.repo';
import { MembershipEventType } from '@prisma/client';

describe('Group Service & Membership History', () => {
  let mockRepo: any;
  let mockAudit: any;
  let service: GroupService;

  beforeEach(() => {
    mockRepo = {
      findGroupByName: vi.fn(),
      createGroup: vi.fn(),
      findGroupById: vi.fn(),
      addMemberToGroup: vi.fn(),
      removeMemberFromGroup: vi.fn(),
      createMembershipHistory: vi.fn(),
      getMembershipHistory: vi.fn(),
    };
    mockAudit = {
      logEvent: vi.fn().mockResolvedValue({}),
      logSystemEvent: vi.fn().mockResolvedValue({}),
    };
    service = new GroupService(mockRepo as unknown as GroupRepository, mockAudit);
  });

  it('should create group if name is unique', async () => {
    mockRepo.findGroupByName.mockResolvedValue(null);
    mockRepo.createGroup.mockResolvedValue({ id: 'g-1', name: 'Goa Trip' });

    const group = await service.createGroup('Goa Trip', 'u-1');
    expect(group.name).toBe('Goa Trip');
    expect(mockRepo.createGroup).toHaveBeenCalledWith('Goa Trip');
    expect(mockAudit.logEvent).toHaveBeenCalled();
  });

  it('should prevent group creation if name is duplicate', async () => {
    mockRepo.findGroupByName.mockResolvedValue({ id: 'g-1', name: 'Goa Trip' });

    await expect(service.createGroup('Goa Trip', 'u-1')).rejects.toThrow(
      "Group with name 'Goa Trip' already exists"
    );
  });

  it('should create join event in history when adding a member', async () => {
    mockRepo.findGroupById.mockResolvedValue({ id: 'g-1', name: 'Flatmates' });
    mockRepo.createMembershipHistory.mockResolvedValue({ id: 'h-1' });
    const joinedAt = new Date('2026-04-08T00:00:00Z');

    await service.addMember('g-1', 'u-sam', joinedAt, 'Sam moved in', 'u-1');

    expect(mockRepo.addMemberToGroup).toHaveBeenCalledWith('g-1', 'u-sam', joinedAt);
    expect(mockRepo.createMembershipHistory).toHaveBeenCalledWith(
      'g-1',
      'u-sam',
      MembershipEventType.JOIN,
      joinedAt,
      'Sam moved in'
    );
    expect(mockAudit.logEvent).toHaveBeenCalled();
  });

  it('should create leave event in history when removing a member', async () => {
    mockRepo.findGroupById.mockResolvedValue({ id: 'g-1', name: 'Flatmates' });
    mockRepo.createMembershipHistory.mockResolvedValue({ id: 'h-2' });
    const leftAt = new Date('2026-03-29T23:59:59Z');

    await service.removeMember('g-1', 'u-meera', leftAt, 'Meera moved out', 'u-1');

    expect(mockRepo.removeMemberFromGroup).toHaveBeenCalledWith('g-1', 'u-meera', leftAt);
    expect(mockRepo.createMembershipHistory).toHaveBeenCalledWith(
      'g-1',
      'u-meera',
      MembershipEventType.LEAVE,
      leftAt,
      'Meera moved out'
    );
    expect(mockAudit.logEvent).toHaveBeenCalled();
  });
});
