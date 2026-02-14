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
    const view = searchParams.get('view') || 'platform'; // 'platform' | 'dc'

    const skip = (page - 1) * limit;

    if (view === 'dc') {
      // Legacy DC website users
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

      const usersWithTotals = users.map((user) => {
        const legacyTotal = user.transactions.reduce(
          (sum, t) => sum + Number(t.amount),
          0
        );
        const { transactions, ...userWithoutTransactions } = user;
        return {
          ...userWithoutTransactions,
          allTimePurchaseTotal: legacyTotal,
          userType: 'dc' as const,
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
        view: 'dc',
      });
    }

    // Platform users view (default) - query CreditBalance directly
    const cbWhere = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { platformUserId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [creditBalances, cbTotal] = await Promise.all([
      prisma.creditBalance.findMany({
        where: cbWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          holds: {
            where: { status: 'ACTIVE' },
            select: { id: true, amount: true, pledgeId: true },
          },
        },
      }),
      prisma.creditBalance.count({ where: cbWhere }),
    ]);

    // Get partner payment aggregates for these platform users
    const platformUserIds = creditBalances.map(cb => cb.platformUserId);

    let paymentAggregates: Record<string, { total: number; count: number; completedCount: number; failedCount: number }> = {};
    if (platformUserIds.length > 0) {
      const payments = await prisma.pendingPartnerPayment.findMany({
        where: {
          platformUserId: { in: platformUserIds },
        },
        select: { platformUserId: true, amount: true, status: true },
      });

      for (const pp of payments) {
        if (!paymentAggregates[pp.platformUserId]) {
          paymentAggregates[pp.platformUserId] = { total: 0, count: 0, completedCount: 0, failedCount: 0 };
        }
        paymentAggregates[pp.platformUserId].count++;
        if (pp.status === 'COMPLETED') {
          paymentAggregates[pp.platformUserId].total += pp.amount / 100;
          paymentAggregates[pp.platformUserId].completedCount++;
        } else if (pp.status === 'FAILED') {
          paymentAggregates[pp.platformUserId].failedCount++;
        }
      }
    }

    const platformUsers = creditBalances.map(cb => ({
      id: cb.id,
      platformUserId: cb.platformUserId,
      email: cb.email || 'Unknown',
      linkedUserId: cb.userId,
      availableBalance: cb.availableBalance,
      heldBalance: cb.heldBalance,
      activeHolds: cb.holds.length,
      allTimePurchaseTotal: paymentAggregates[cb.platformUserId]?.total || 0,
      totalPayments: paymentAggregates[cb.platformUserId]?.count || 0,
      completedPayments: paymentAggregates[cb.platformUserId]?.completedCount || 0,
      failedPayments: paymentAggregates[cb.platformUserId]?.failedCount || 0,
      createdAt: cb.createdAt,
      userType: 'platform' as const,
    }));

    return NextResponse.json({
      users: platformUsers,
      pagination: {
        page,
        limit,
        total: cbTotal,
        pages: Math.ceil(cbTotal / limit),
      },
      view: 'platform',
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
