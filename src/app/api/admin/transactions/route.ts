// app/api/admin/transactions/route.ts
// Transaction list API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const source = searchParams.get('source'); // 'legacy', 'partner', or null for all

    const skip = (page - 1) * limit;

    // Legacy transactions
    if (source === 'partner') {
      // Only show partner payments
      const ppWhere: any = {};
      if (status) ppWhere.status = status;

      const [partnerPayments, ppTotal] = await Promise.all([
        prisma.pendingPartnerPayment.findMany({
          where: ppWhere,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.pendingPartnerPayment.count({ where: ppWhere }),
      ]);

      return NextResponse.json({
        transactions: [],
        partnerPayments,
        pagination: {
          page,
          limit,
          total: ppTotal,
          pages: Math.ceil(ppTotal / limit),
        },
      });
    }

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [transactions, total, partnerPayments, ppTotal] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: source === 'legacy' ? limit : Math.ceil(limit / 2),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          giftCard: { select: { codeLast4: true, amount: true } },
        },
      }),
      prisma.transaction.count({ where }),
      // Also fetch partner payments unless filtering to legacy only
      source === 'legacy'
        ? Promise.resolve([])
        : prisma.pendingPartnerPayment.findMany({
            where: status ? { status } : {},
            skip,
            take: Math.ceil(limit / 2),
            orderBy: { createdAt: 'desc' },
          }),
      source === 'legacy'
        ? Promise.resolve(0)
        : prisma.pendingPartnerPayment.count({ where: status ? { status } : {} }),
    ]);

    const combinedTotal = total + (typeof ppTotal === 'number' ? ppTotal : 0);

    return NextResponse.json({
      transactions,
      partnerPayments: partnerPayments || [],
      pagination: {
        page,
        limit,
        total: combinedTotal,
        legacyTotal: total,
        partnerTotal: typeof ppTotal === 'number' ? ppTotal : 0,
        pages: Math.ceil(combinedTotal / limit),
      },
    });
  } catch (error) {
    logger.apiError('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
