// app/api/cards/[id]/status/route.ts
// Check gift card status by ID

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiRateLimiter, createRateLimitKey } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: Rate limiting to prevent enumeration attacks
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = createRateLimitKey('card-status', clientIP);
    const rateLimit = apiRateLimiter.check(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      );
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      select: {
        id: true,
        codeLast4: true,
        amount: true,
        status: true,
        createdAt: true,
        activatedAt: true,
        redeemedAt: true,
        expiresAt: true,
      },
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: giftCard.id,
      codeLast4: giftCard.codeLast4,
      amount: giftCard.amount,
      status: giftCard.status,
      createdAt: giftCard.createdAt.toISOString(),
      activatedAt: giftCard.activatedAt?.toISOString() || null,
      redeemedAt: giftCard.redeemedAt?.toISOString() || null,
      expiresAt: giftCard.expiresAt?.toISOString() || null,
    });
  } catch (error) {
    logger.apiError('/api/cards/[id]/status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
