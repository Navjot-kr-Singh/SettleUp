import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/auth/register/route';
import { prisma } from '../../lib/prisma';
import { UserService } from '../../services/user';
import { UserRepository } from '../../repositories/user.repo';
import * as bcrypt from 'bcryptjs';

// Setup custom bcrypt mock to intercept hash rounds
let lastHashRounds: number | null = null;
vi.mock('bcryptjs', async (importOriginal) => {
  const original = await importOriginal<typeof import('bcryptjs')>();
  return {
    ...original,
    hash: vi.fn(async (password: string, rounds: any) => {
      lastHashRounds = rounds;
      return original.hash(password, rounds);
    }),
  };
});

vi.mock('../../lib/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

describe('Registration System Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastHashRounds = null;
  });

  describe('User Registration Handler (POST /api/auth/register)', () => {
    it('should create account successfully with valid input', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({} as any);

      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Account created successfully');
      
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            isGuest: false,
            role: 'MEMBER',
          }),
        })
      );
    });

    it('should store hashed password with 12 rounds of bcrypt', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({} as any);

      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'mySecretPassword',
        confirmPassword: 'mySecretPassword',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      await POST(req);

      expect(lastHashRounds).toBe(12);
    });

    it('should reject duplicate email registration', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing-id' } as any);

      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Email already exists');
    });

    it('should reject invalid email inputs', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'not-an-email',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should reject weak password shorter than 8 characters', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'short',
        confirmPassword: 'short',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should reject mismatched confirmation passwords', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securePassword123',
        confirmPassword: 'mismatchedPassword123',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('Guest Users Architecture & Exclusions', () => {
    it('should generate guest user with isGuest=true and placeholder values', async () => {
      const repo = new UserRepository(prisma);
      const service = new UserService(repo);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({} as any);

      await service.createGuestUser('Temp Guest');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Temp Guest',
            email: expect.stringMatching(/^guest-[a-f0-9-]+\@settleup\.local$/),
            passwordHash: 'guest-account',
            isGuest: true,
            role: 'GUEST',
          }),
        })
      );
    });
  });
});
