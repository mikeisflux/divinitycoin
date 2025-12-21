// app/api/partners/setup/route.ts
// Complete partner account setup

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Find partner with this setup token
    const partner = await prisma.partner.findFirst({
      where: {
        settings: {
          path: ['setupToken'],
          equals: token,
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Invalid setup token' }, { status: 404 });
    }

    const settings = partner.settings as any;

    // Check if token is expired
    if (settings?.setupTokenExpires && new Date(settings.setupTokenExpires) < new Date()) {
      return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 });
    }

    // Check if already set up
    if (settings?.passwordHash) {
      return NextResponse.json({ error: 'Account already set up' }, { status: 409 });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update partner with password and clear setup token
    const updatedSettings = {
      ...settings,
      passwordHash,
      setupToken: null,
      setupTokenExpires: null,
      setupCompletedAt: new Date().toISOString(),
    };

    await prisma.partner.update({
      where: { id: partner.id },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to complete setup:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
