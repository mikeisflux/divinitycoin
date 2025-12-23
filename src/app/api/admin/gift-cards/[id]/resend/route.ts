// app/api/admin/gift-cards/[id]/resend/route.ts
// Resend gift card code email

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: params.id },
    });

    if (!giftCard) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    }

    if (giftCard.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Can only resend email for active gift cards' }, { status: 400 });
    }

    const recipientEmail = giftCard.purchasedByEmail;

    if (!recipientEmail) {
      return NextResponse.json({ error: 'No email address on file for this gift card' }, { status: 400 });
    }

    // Try to get the original code from Stripe checkout session metadata
    if (!giftCard.stripeCheckoutSessionId) {
      return NextResponse.json({
        error: 'Cannot resend email - original code not available. The code was only sent during initial purchase.'
      }, { status: 400 });
    }

    try {
      const stripe = await getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(giftCard.stripeCheckoutSessionId);

      if (!session.metadata?.giftCardCode) {
        return NextResponse.json({
          error: 'Cannot resend email - original code not available in payment records.'
        }, { status: 400 });
      }

      const code = session.metadata.giftCardCode;

      // Send the email
      const result = await sendGiftCardEmail({
        to: recipientEmail,
        code,
        amount: Number(giftCard.amount),
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
      }

      await logAdminAction(
        admin!.id,
        'GIFTCARD_RESEND_EMAIL',
        'giftCard',
        params.id,
        { recipientEmail },
        getClientIP(request),
        getUserAgent(request)
      );

      return NextResponse.json({ success: true });
    } catch (stripeError) {
      logger.apiError('Stripe error retrieving session:', error);
      return NextResponse.json({
        error: 'Cannot resend email - payment records not accessible.'
      }, { status: 400 });
    }
  } catch (error) {
    logger.apiError('Failed to resend gift card email:', error);
    return NextResponse.json({ error: 'Failed to resend email' }, { status: 500 });
  }
}
