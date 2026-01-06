// app/api/admin/users/[id]/ban/route.ts
// Ban/Unban user API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

// Ban user
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { reason } = await request.json();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.bannedAt) {
      return NextResponse.json({ error: 'User is already banned' }, { status: 400 });
    }

    // Ban the user
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        bannedAt: new Date(),
        banReason: reason || 'No reason provided',
      },
    });

    // Invalidate all user sessions
    await prisma.session.deleteMany({
      where: { userId: params.id },
    });

    await logAdminAction(
      admin!.id,
      'USER_BAN',
      'user',
      user.id,
      { email: user.email, reason: reason || 'No reason provided' },
      getClientIP(request),
      getUserAgent(request)
    );

    logger.info('User banned', { userId: user.id, email: user.email, adminId: admin!.id });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
      }
    });
  } catch (error) {
    logger.apiError('Failed to ban user:', error);
    return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
  }
}

// Unban user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!existingUser.bannedAt) {
      return NextResponse.json({ error: 'User is not banned' }, { status: 400 });
    }

    // Unban the user
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        bannedAt: null,
        banReason: null,
      },
    });

    await logAdminAction(
      admin!.id,
      'USER_UNBAN',
      'user',
      user.id,
      { email: user.email },
      getClientIP(request),
      getUserAgent(request)
    );

    logger.info('User unbanned', { userId: user.id, email: user.email, adminId: admin!.id });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
      }
    });
  } catch (error) {
    logger.apiError('Failed to unban user:', error);
    return NextResponse.json({ error: 'Failed to unban user' }, { status: 500 });
  }
}
