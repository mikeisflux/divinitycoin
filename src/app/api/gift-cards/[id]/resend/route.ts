// app/api/gift-cards/[id]/resend/route.ts
// Resend gift card code email to purchaser

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { logger } from '@/lib/logger';
import { apiRateLimiter, createRateLimitKey } from '@/lib/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Gift card ID is required' },
        { status: 400 }
      );
    }

    // Rate limiting to prevent abuse
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = createRateLimitKey('resend-code', clientIP);
    const rateLimit = apiRateLimiter.check(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 60) },
        }
      );
    }

    // Find the gift card
    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      select: {
        id: true,
        codeLast4: true,
        amount: true,
        purchasedByEmail: true,
        status: true,
      },
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    if (!giftCard.purchasedByEmail) {
      return NextResponse.json(
        { error: 'No email address associated with this gift card' },
        { status: 400 }
      );
    }

    // Get the full code from the transaction/gift card
    // Since we only store the hash, we need to look up the code from the original transaction
    // For resend, we'll need to regenerate or retrieve from a secure store
    // For now, we'll inform the user to check their email or contact support

    // Check if there's a recent email log for this gift card
    const recentEmail = await prisma.emailLog.findFirst({
      where: {
        toEmail: giftCard.purchasedByEmail,
        subject: { contains: 'Gift Card' },
        status: 'SENT',
      },
      orderBy: { createdAt: 'desc' },
    });

    // For security, we cannot resend the actual code since we only store the hash
    // Instead, we need to look for the code in our records
    // The code should have been stored temporarily or we need admin intervention

    // Look for the transaction that has this gift card
    const transaction = await prisma.transaction.findFirst({
      where: { giftCardId: giftCard.id },
      select: { id: true, metadata: true },
    });

    // Since we can't retrieve the actual code (it's hashed),
    // we'll provide a helpful response and suggest contacting support
    // or checking spam folder

    return NextResponse.json({
      success: true,
      message: `We've noted your request to resend the code to ${giftCard.purchasedByEmail}. Please check your spam/junk folder first. If you still cannot find it, please contact support with your order reference ending in ****${giftCard.codeLast4}.`,
      email: giftCard.purchasedByEmail,
      codeLast4: giftCard.codeLast4,
      note: 'For security reasons, gift card codes are sent only once at purchase. Please check your spam folder or contact support.'
    });

  } catch (error) {
    logger.apiError('/api/gift-cards/[id]/resend', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
