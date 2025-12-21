// app/api/cards/check/route.ts
// Check gift card status by code (public endpoint with rate limiting)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashCode, isValidCodeFormat } from '@/lib/giftcard/generate';
import { RateLimiter } from '@/lib/rateLimit';

const checkLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 10, // 10 checks per minute per IP
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Rate limiting
    const { allowed, remaining } = checkLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': '0' },
        }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    // Remove dashes and spaces, uppercase
    const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();

    // Validate format
    if (!isValidCodeFormat(cleanCode)) {
      return NextResponse.json(
        { error: 'Invalid code format. Please check your code and try again.' },
        { status: 400 }
      );
    }

    // Hash the code
    const codeHash = hashCode(cleanCode);

    // Look up the gift card
    const giftCard = await prisma.giftCard.findUnique({
      where: { codeHash },
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
        { error: 'Code not found. Please check your code and try again.' },
        { status: 404 }
      );
    }

    // Prepare response based on status
    const statusMessages: Record<string, string> = {
      PENDING: 'This card is pending activation. It should be activated shortly.',
      ACTIVE: 'This card is active and ready to use.',
      REDEEMED: 'This card has already been redeemed.',
      EXPIRED: 'This card has expired.',
      REVOKED: 'This card has been revoked.',
    };

    return NextResponse.json({
      valid: giftCard.status === 'ACTIVE',
      codeLast4: giftCard.codeLast4,
      amount: giftCard.amount,
      status: giftCard.status,
      statusMessage: statusMessages[giftCard.status] || 'Unknown status',
      createdAt: giftCard.createdAt.toISOString(),
      activatedAt: giftCard.activatedAt?.toISOString() || null,
      redeemedAt: giftCard.redeemedAt?.toISOString() || null,
      expiresAt: giftCard.expiresAt?.toISOString() || null,
    }, {
      headers: { 'X-RateLimit-Remaining': remaining.toString() },
    });
  } catch (error) {
    console.error('Error checking card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
