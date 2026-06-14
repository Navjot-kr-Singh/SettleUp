import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import * as bcrypt from 'bcryptjs';

vi.mock('../../lib/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe('NextAuth Configuration & Credentials Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const credentialsProvider = authOptions.providers.find(
    (p: any) => p.id === 'credentials'
  );

  it('should find the credentials provider', () => {
    expect(credentialsProvider).toBeDefined();
  });

  it('should reject invalid credentials inputs', async () => {
    const user = await (credentialsProvider as any).options.authorize({
      email: '',
      password: '',
    });
    expect(user).toBeNull();
  });

  it('should authorize registered user with correct email and password', async () => {
    const plainPassword = 'securePassword123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Mock the findUnique response for email
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-user-123',
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: hashedPassword,
      isGuest: false,
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = await (credentialsProvider as any).options.authorize({
      email: 'john@example.com',
      password: plainPassword,
    });

    expect(user).not.toBeNull();
    expect(user.name).toBe('John Doe');
    expect(user.role).toBe('MEMBER');
  });

  it('should deny authorization if password hash comparison fails', async () => {
    const plainPassword = 'wrongpassword';
    const hashedPassword = await bcrypt.hash('securePassword123', 12);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-user-123',
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: hashedPassword,
      isGuest: false,
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = await (credentialsProvider as any).options.authorize({
      email: 'john@example.com',
      password: plainPassword,
    });

    expect(user).toBeNull();
  });

  it('should deny authorization for unknown email addresses', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const user = await (credentialsProvider as any).options.authorize({
      email: 'unknown@example.com',
      password: 'password123',
    });

    expect(user).toBeNull();
  });

  it('should reject guest users attempting credentials authentication', async () => {
    const plainPassword = 'guestPassword123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-guest-123',
      name: 'Temp Guest',
      email: 'guest-123@settleup.local',
      passwordHash: hashedPassword,
      isGuest: true,
      role: 'GUEST',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = await (credentialsProvider as any).options.authorize({
      email: 'guest-123@settleup.local',
      password: plainPassword,
    });

    expect(user).toBeNull();
  });
});
