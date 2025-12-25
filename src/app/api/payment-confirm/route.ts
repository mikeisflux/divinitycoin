// app/api/payment-confirm/route.ts
// Confirms payment and generates gift card code

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

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

    // If already processed, return existing gift card info (idempotent)
    if (transaction.status === 'COMPLETED' && transaction.giftCard) {
      logger.info('Transaction already processed, returning existing gift card', {
        transactionId,
        giftCardId: transaction.giftCard.id,
      });
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        giftCardId: transaction.giftCard.id,
        code: null, // Cannot return code for already processed - it's hashed
        codeLast4: transaction.giftCard.codeLast4,
        amount: Number(transaction.amount),
      });
    }

    // Generate gift card code NOW (after payment confirmed)
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);
    const email = transaction.guestEmail || paymentIntent.receipt_email || '';

    // Extract partnerId from metadata
    const partnerId = paymentIntent.metadata.partnerId ||
      (transaction.metadata as { partnerId?: string } | null)?.partnerId ||
      null;

    // Use database transaction with isolation to prevent race conditions
    let giftCard;
    let isNewGiftCard = true;

    try {
      giftCard = await prisma.$transaction(async (tx) => {
        // Re-check transaction status inside transaction to prevent race condition
        const freshTransaction = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: { giftCard: true },
        });

        if (freshTransaction?.status === 'COMPLETED' && freshTransaction.giftCard) {
          // Another request already processed this - return existing
          isNewGiftCard = false;
          return freshTransaction.giftCard;
        }

        // Create gift card with partner reference
        const newGiftCard = await tx.giftCard.create({
          data: {
            codeHash,
            codeLast4,
            amount: transaction.amount,
            currency: 'USD',
            status: 'ACTIVE',
            purchasedByEmail: email,
            activatedAt: new Date(),
            partnerId: partnerId || undefined,
          },
        });

        // Update transaction to completed
        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            giftCardId: newGiftCard.id,
          },
        });

        return newGiftCard;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second timeout
      });
    } catch (txError) {
      // Handle race condition - if transaction failed due to concurrent request,
      // fetch the existing gift card
      if (txError instanceof Prisma.PrismaClientKnownRequestError) {
        logger.warn('Transaction conflict, checking for existing gift card', {
          transactionId,
          errorCode: txError.code,
        });

        const existingTransaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { giftCard: true },
        });

        if (existingTransaction?.giftCard) {
          return NextResponse.json({
            success: true,
            alreadyProcessed: true,
            giftCardId: existingTransaction.giftCard.id,
            code: null,
            codeLast4: existingTransaction.giftCard.codeLast4,
            amount: Number(transaction.amount),
          });
        }
      }
      throw txError;
    }

    // If we got an existing gift card from the transaction, return it
    if (!isNewGiftCard) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        giftCardId: giftCard.id,
        code: null,
        codeLast4: giftCard.codeLast4,
        amount: Number(transaction.amount),
      });
    }

    // Send gift card email (only for new gift cards)
    if (email) {
      try {
        const emailResult = await sendGiftCardEmail({
          to: email,
          code: code,
          amount: Number(transaction.amount),
        });

        if (!emailResult.success) {
          logger.error('Gift card email send failed', {
            error: emailResult.error,
            giftCardId: giftCard.id,
            email: email,
          });
        } else {
          logger.info('Gift card email sent successfully', {
            giftCardId: giftCard.id,
            messageId: emailResult.messageId,
          });
        }
      } catch (emailError) {
        logger.error('Failed to send gift card email (exception)', { error: emailError, giftCardId: giftCard.id });
        // Don't fail the request - gift card was created successfully
      }
    } else {
      logger.warn('No email address for gift card, skipping email send', { giftCardId: giftCard.id });
    }

    return NextResponse.json({
      success: true,
      giftCardId: giftCard.id,
      code: code, // Return full code for display on success screen
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
