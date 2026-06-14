import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from '../../services/membership';
import { PrismaClient, UserRole } from '@prisma/client';

describe('Membership Validation Service (Database-Driven)', () => {
  let mockPrisma: any;
  let service: MembershipService;

  beforeEach(() => {
    // Create a mock Prisma Client to prevent connection calls
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      groupMembership: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new MembershipService(mockPrisma as unknown as PrismaClient);
  });

  describe('isUserActiveOnDate', () => {
    it('should approve guest users on any date (bypassing memberships)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-kabir',
        name: 'Kabir',
        role: UserRole.GUEST,
      });

      const isActive = await service.isUserActiveOnDate(
        'g-spreetail',
        'u-kabir',
        new Date('2026-02-15')
      );
      
      expect(isActive).toBe(true);
      expect(mockPrisma.groupMembership.findUnique).not.toHaveBeenCalled();
    });

    it('should validate regular members inside active boundaries', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-meera',
        name: 'Meera',
        role: UserRole.MEMBER,
      });

      // Meera active from Feb 1 to March 29, 2026
      mockPrisma.groupMembership.findUnique.mockResolvedValue({
        userId: 'u-meera',
        groupId: 'g-spreetail',
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        leftAt: new Date('2026-03-29T23:59:59Z'),
      });

      // Active date
      const activeCheck = await service.isUserActiveOnDate(
        'g-spreetail',
        'u-meera',
        new Date('2026-02-15T00:00:00Z')
      );
      expect(activeCheck).toBe(true);

      // Inactive date after leaving
      const postLeaveCheck = await service.isUserActiveOnDate(
        'g-spreetail',
        'u-meera',
        new Date('2026-04-02T00:00:00Z')
      );
      expect(postLeaveCheck).toBe(false);
    });

    it('should validate new members after entry boundary', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-sam',
        name: 'Sam',
        role: UserRole.MEMBER,
      });

      // Sam joined April 8
      mockPrisma.groupMembership.findUnique.mockResolvedValue({
        userId: 'u-sam',
        groupId: 'g-spreetail',
        joinedAt: new Date('2026-04-08T00:00:00Z'),
        leftAt: null,
      });

      // Checking date before joining
      const preJoinCheck = await service.isUserActiveOnDate(
        'g-spreetail',
        'u-sam',
        new Date('2026-04-01T00:00:00Z')
      );
      expect(preJoinCheck).toBe(false);

      // Checking date after joining
      const postJoinCheck = await service.isUserActiveOnDate(
        'g-spreetail',
        'u-sam',
        new Date('2026-04-10T00:00:00Z')
      );
      expect(postJoinCheck).toBe(true);
    });
  });
});
