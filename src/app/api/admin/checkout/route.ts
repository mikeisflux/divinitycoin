// app/api/admin/checkout/route.ts
// Admin list API for hosted checkout sessions.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const mode = searchParams.get('mode');
    const partnerId = searchParams.get('partnerId');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (mode) where.mode = mode;
    if (partnerId) where.partnerId = partnerId;
    if (search) {
      where.OR = [
        { sessionToken: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { platformUserId: { contains: search, mode: 'insensitive' } },
        { paymentIntentId: { contains: search, mode: 'insensitive' } },
        { setupIntentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sessions, total] = await Promise.all([
      prisma.checkoutSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.checkoutSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionToken: s.sessionToken,
        mode: s.mode,
        status: s.status,
        amount: s.amount,
        currency: s.currency,
        email: s.email,
        platformUserId: s.platformUserId,
        partnerId: s.partnerId,
        partnerName: s.partner?.name ?? s.partnerName ?? null,
        partnerSlug: s.partner?.slug ?? null,
        pledgeId: s.pledgeId,
        paymentIntentId: s.paymentIntentId,
        setupIntentId: s.setupIntentId,
        paymentMethodId: s.paymentMethodId,
        expiresAt: s.expiresAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
        webhookFiredAt: s.webhookFiredAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.apiError('/api/admin/checkout', error);
    return NextResponse.json({ error: 'Failed to fetch checkout sessions' }, { status: 500 });
  }
}
