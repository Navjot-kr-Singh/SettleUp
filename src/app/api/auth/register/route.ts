import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parseResult = RegisterSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 });
    }

    const { name, email, password } = parseResult.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
    }

    // Hash password with 12 rounds
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isGuest: false,
        role: 'MEMBER',
      },
    });

    return NextResponse.json(
      { success: true, message: 'Account created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[REGISTRATION_API_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
