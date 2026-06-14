import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import * as bcrypt from 'bcryptjs';
import { AuditLogRepository } from '@/repositories/audit.repo';
import { AuditService } from '@/services/AuditService';
import { AuditActionType } from '@prisma/client';

const auditRepo = new AuditLogRepository(prisma);
const auditService = new AuditService(auditRepo);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          await auditService.logSystemEvent({
            action: AuditActionType.LOGIN_FAILURE,
            notes: `Login failed: user with email '${email}' not found.`,
            metadata: { email },
          });
          return null;
        }

        if (user.isGuest) {
          await auditService.logSystemEvent({
            action: AuditActionType.LOGIN_FAILURE,
            notes: `Login failed: guest user '${user.name}' (${email}) cannot authenticate.`,
            metadata: { email },
            actorId: user.id,
          });
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          await auditService.logSystemEvent({
            action: AuditActionType.LOGIN_FAILURE,
            notes: `Login failed: incorrect password for user '${user.name}' (${email}).`,
            metadata: { email },
            actorId: user.id,
          });
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await auditService.logSystemEvent({
        action: AuditActionType.LOGIN_SUCCESS,
        notes: `User '${user.name}' logged in successfully.`,
        actorId: user.id,
      });
    },
    async signOut({ token }) {
      if (token && token.id) {
        await auditService.logSystemEvent({
          action: AuditActionType.LOGOUT,
          notes: `User logged out.`,
          actorId: token.id as string,
        });
      }
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
