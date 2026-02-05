// app/api/auth/update-email/route.ts
// Update user email endpoint

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyPassword, getUserByEmail } from '@/lib/auth/user';
import { prisma } from '@/lib/db';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newEmail, currentPassword } = body;

    // Validate inputs
    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: 'New email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(newEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = newEmail.toLowerCase().trim();

    // Check if email is the same
    if (normalizedEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'New email is the same as current email' },
        { status: 400 }
      );
    }

    // Verify current password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Cannot update email for this account type' },
        { status: 400 }
      );
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Check if new email is already taken
    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { error: 'This email address is already in use' },
        { status: 400 }
      );
    }

    // Update the email
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { email: normalizedEmail },
    });

    logger.info('User email updated', {
      userId: user.id,
      oldEmail: user.email,
      newEmail: normalizedEmail,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      },
    });
  } catch (error) {
    logger.apiError('Update email error:', error);
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 }
    );
  }
}
