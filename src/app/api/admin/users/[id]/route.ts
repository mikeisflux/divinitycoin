// app/api/admin/users/[id]/route.ts
// Individual user API - GET, PUT, DELETE

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/user';

// Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        creditBalances: {
          include: {
            holds: {
              where: { status: 'ACTIVE' },
            },
          },
        },
        purchasedCards: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            transactions: true,
            purchasedCards: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { name, email, password, emailVerified } = await request.json();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (emailTaken) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
      }
    }

    // Validate password if provided
    if (password && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name || null;
    if (email) updateData.email = email.toLowerCase();
    if (password) updateData.passwordHash = await hashPassword(password);
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified ? new Date() : null;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAdminAction(
      admin!.id,
      'USER_UPDATE',
      'user',
      user.id,
      {
        changes: Object.keys(updateData),
        passwordChanged: !!password,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        creditBalances: true,
        _count: {
          select: {
            transactions: true,
            purchasedCards: true,
          },
        },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has balance
    const totalBalance = existingUser.creditBalances.reduce(
      (sum, b) => sum + Number(b.availableBalance) + Number(b.heldBalance),
      0
    );

    if (totalBalance > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with remaining balance. Please clear balance first.' },
        { status: 400 }
      );
    }

    // Delete related records in order
    await prisma.$transaction([
      // Delete sessions
      prisma.session.deleteMany({ where: { userId: params.id } }),
      // Delete credit holds
      prisma.creditHold.deleteMany({
        where: { creditBalance: { userId: params.id } },
      }),
      // Delete credit balances
      prisma.creditBalance.deleteMany({ where: { userId: params.id } }),
      // Delete transactions
      prisma.transaction.deleteMany({ where: { userId: params.id } }),
      // Finally delete user
      prisma.user.delete({ where: { id: params.id } }),
    ]);

    await logAdminAction(
      admin!.id,
      'USER_DELETE',
      'user',
      params.id,
      { email: existingUser.email, name: existingUser.name },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
