// app/api/admin/transactions/route.ts
// Transaction list API

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

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          giftCard: { select: { codeLast4: true, amount: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
