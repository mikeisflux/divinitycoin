// app/api/admin/gift-cards/route.ts
// Gift card list API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    // Search by code last 4, purchaser email, or redeemer email
    if (search) {
      where.OR = [
        { codeLast4: { contains: search, mode: 'insensitive' } },
        { purchasedByEmail: { contains: search, mode: 'insensitive' } },
        { redeemedByEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [giftCards, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.giftCard.count({ where }),
    ]);

    return NextResponse.json({
      giftCards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch gift cards:', error);
    return NextResponse.json({ error: 'Failed to fetch gift cards' }, { status: 500 });
  }
}
