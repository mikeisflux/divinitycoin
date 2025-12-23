// app/api/payment-confirm/route.ts
// Confirms payment and generates gift card code

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { logger } from '@/lib/logger';

interface ConfirmRequest {
  paymentIntentId: string;
  transactionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmRequest = await request.json();
    const { paymentIntentId, transactionId } = body;

    if (!paymentIntentId || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify the payment with Stripe
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment has not been completed' },
        { status: 400 }
      );
    }

    // Check if transaction exists and matches
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { giftCard: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.stripePaymentIntentId !== paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent mismatch' },
        { status: 400 }
      );
    }

    // SECURITY: Validate payment amount matches transaction amount
    // Stripe amounts are in cents, transaction amounts are in dollars
    const expectedAmountCents = Math.round(Number(transaction.amount) * 100);
    if (paymentIntent.amount !== expectedAmountCents) {
      logger.error('Payment amount mismatch: expected ${expectedAmountCents}, got ${paymentIntent.amount}');
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      );
    }

    // If already processed, return existing gift card info
    if (transaction.status === 'COMPLETED' && transaction.giftCard) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        giftCardId: transaction.giftCard.id,
        codeLast4: transaction.giftCard.codeLast4,
        amount: Number(transaction.amount),
      });
    }

    // Generate gift card code NOW (after payment confirmed)
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);
    const email = transaction.guestEmail || paymentIntent.receipt_email || '';

    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        codeHash,
        codeLast4,
        amount: transaction.amount,
        currency: 'USD',
        status: 'ACTIVE',
        purchasedByEmail: email,
        activatedAt: new Date(),
      },
    });

    // Update transaction to completed
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        giftCardId: giftCard.id,
      },
    });

    // Send gift card email
    if (email) {
      try {
        await sendGiftCardEmail({
          to: email,
          code: code,
          amount: Number(transaction.amount),
        });
      } catch (emailError) {
        logger.apiError('Failed to send gift card email:', error);
        // Don't fail the request - gift card was created successfully
      }
    }

    return NextResponse.json({
      success: true,
      giftCardId: giftCard.id,
      codeLast4: codeLast4,
      amount: Number(transaction.amount),
    });
  } catch (error) {
    // SECURITY: Use sanitized logger to prevent sensitive data exposure
    logger.apiError('/api/payment-confirm', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment. Please contact support.' },
      { status: 500 }
    );
  }
}
