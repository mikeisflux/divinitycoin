// app/api/admin/users/route.ts
// User list and create API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/user';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creditBalances: {
            select: {
              availableBalance: true,
              heldBalance: true,
              platformUserId: true,
            },
          },
          _count: {
            select: { transactions: true, purchasedCards: true },
          },
          transactions: {
            where: {
              type: 'PURCHASE',
              status: 'COMPLETED',
            },
            select: { amount: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Get partner payment totals for users that have credit balances with platformUserIds
    const platformUserIds = users
      .flatMap((u) => u.creditBalances.map((cb) => cb.platformUserId))
      .filter(Boolean) as string[];

    let partnerPaymentTotals: Record<string, number> = {};
    let partnerPaymentCounts: Record<string, number> = {};
    if (platformUserIds.length > 0) {
      const partnerPayments = await prisma.pendingPartnerPayment.findMany({
        where: {
          platformUserId: { in: platformUserIds },
          status: 'COMPLETED',
        },
        select: { platformUserId: true, amount: true },
      });

      for (const pp of partnerPayments) {
        partnerPaymentTotals[pp.platformUserId] = (partnerPaymentTotals[pp.platformUserId] || 0) + (pp.amount / 100);
        partnerPaymentCounts[pp.platformUserId] = (partnerPaymentCounts[pp.platformUserId] || 0) + 1;
      }
    }

    // Calculate all-time purchase total for each user (legacy + partner payments)
    const usersWithTotals = users.map((user) => {
      const legacyTotal = user.transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );

      // Sum partner payment totals for this user's credit balances
      let partnerTotal = 0;
      let partnerCount = 0;
      for (const cb of user.creditBalances) {
        if (cb.platformUserId && partnerPaymentTotals[cb.platformUserId]) {
          partnerTotal += partnerPaymentTotals[cb.platformUserId];
          partnerCount += partnerPaymentCounts[cb.platformUserId] || 0;
        }
      }

      const allTimePurchaseTotal = legacyTotal + partnerTotal;
      const totalTransactionCount = (user._count.transactions || 0) + partnerCount;

      // Remove transactions array from response to keep it clean
      const { transactions, ...userWithoutTransactions } = user;
      return {
        ...userWithoutTransactions,
        allTimePurchaseTotal,
        _count: {
          ...userWithoutTransactions._count,
          transactions: totalTransactionCount,
        },
      };
    });

    return NextResponse.json({
      users: usersWithTotals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.apiError('/api/admin/users', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// Create new user
export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { email, name, password } = await request.json();

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Validate password if provided
    if (password && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        passwordHash: password ? await hashPassword(password) : null,
      },
    });

    await logAdminAction(
      admin!.id,
      'USER_CREATE',
      'user',
      user.id,
      { email: user.email, name: user.name },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ user });
  } catch (error) {
    logger.apiError('/api/admin/users', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
