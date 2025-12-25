// app/webhook/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getStripeClient, getWebhookSecret } from '@/lib/stripe';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Get webhook secret from config
    const webhookSecret = await getWebhookSecret();
    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    try {
      const stripe = await getStripeClient();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logger.warn('Webhook signature verification failed', { error: err });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'checkout.session.completed':
        await handleSuccessfulPayment(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await handleExpiredSession(event.data.object as Stripe.Checkout.Session);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.apiError('/webhook/stripe', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle PaymentIntent succeeded - fallback for when frontend confirmation fails
 * This ensures transactions are completed even if the user's browser closes
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const transactionId = paymentIntent.metadata?.transactionId;

  if (!transactionId) {
    logger.debug('PaymentIntent succeeded without transactionId metadata', {
      paymentIntentId: paymentIntent.id
    });
    return;
  }

  // Find the transaction
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { giftCard: true },
  });

  if (!transaction) {
    logger.warn('Transaction not found for PaymentIntent', {
      paymentIntentId: paymentIntent.id,
      transactionId
    });
    return;
  }

  // If already completed, nothing to do
  if (transaction.status === 'COMPLETED' && transaction.giftCard) {
    logger.debug('Transaction already completed via webhook', { transactionId });
    return;
  }

  // Validate payment amount matches transaction amount
  const expectedAmountCents = Math.round(Number(transaction.amount) * 100);
  if (paymentIntent.amount !== expectedAmountCents) {
    logger.error('Webhook payment amount mismatch', {
      expected: expectedAmountCents,
      received: paymentIntent.amount,
      transactionId,
    });
    return;
  }

  // Get email for the gift card
  const email = transaction.guestEmail || paymentIntent.receipt_email || '';
  const partnerId = paymentIntent.metadata?.partnerId || null;

  // Generate gift card and complete transaction atomically
  try {
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);

    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction
      const freshTransaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { giftCard: true },
      });

      if (freshTransaction?.status === 'COMPLETED' && freshTransaction.giftCard) {
        // Already processed by frontend or another webhook
        return;
      }

      // Create gift card
      const giftCard = await tx.giftCard.create({
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

      // Update transaction
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          giftCardId: giftCard.id,
        },
      });

      // Send email with code
      if (email) {
        try {
          await sendGiftCardEmail({
            to: email,
            code: code,
            amount: Number(transaction.amount),
          });
          logger.info('Gift card email sent via webhook fallback', {
            transactionId,
            giftCardId: giftCard.id
          });
        } catch (emailError) {
          logger.error('Failed to send gift card email from webhook', {
            error: emailError,
            giftCardId: giftCard.id
          });
        }
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });

    logger.info('Transaction completed via webhook fallback', {
      transactionId,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Likely a race condition - check if already completed
      const existingTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { giftCard: true },
      });

      if (existingTransaction?.status === 'COMPLETED') {
        logger.debug('Transaction was completed by concurrent request', { transactionId });
        return;
      }
    }
    logger.error('Webhook failed to complete transaction', { error, transactionId });
    throw error;
  }
}

/**
 * Handle successful payment - activate gift card and send email
 */
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  const { giftCardId, giftCardCode } = session.metadata || {};

  if (!giftCardId || !giftCardCode) {
    logger.error('Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  // Update gift card status to ACTIVE
  const giftCard = await prisma.giftCard.update({
    where: { id: giftCardId },
    data: {
      status: 'ACTIVE',
      stripePaymentIntentId: session.payment_intent as string,
    },
  });

  // Update transaction status
  await prisma.transaction.updateMany({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status: 'COMPLETED',
      stripePaymentIntentId: session.payment_intent as string,
      completedAt: new Date(),
    },
  });

  // Send gift card email
  if (session.customer_email) {
    try {
      await sendGiftCardEmail({
        to: session.customer_email,
        code: giftCardCode,
        amount: Number(giftCard.amount),
      });
    } catch (error) {
      logger.error('Failed to send gift card email', { error, giftCardId });
    }
  }
}

/**
 * Handle expired checkout session - cleanup pending gift card
 */
async function handleExpiredSession(session: Stripe.Checkout.Session) {
  const { giftCardId } = session.metadata || {};

  if (!giftCardId) {
    return;
  }

  // Delete the pending gift card
  await prisma.giftCard.delete({
    where: { id: giftCardId },
  }).catch(() => {
    // Gift card may already be deleted or in different state
  });

  // Update transaction status
  await prisma.transaction.updateMany({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status: 'FAILED',
      failureReason: 'Checkout session expired',
    },
  });
}

/**
 * Handle refund - revoke gift card
 */
async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) {
    return;
  }

  // Find and revoke the gift card
  const giftCard = await prisma.giftCard.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!giftCard) {
    logger.warn('Gift card not found for refund', { paymentIntentId });
    return;
  }

  // Only revoke if not already redeemed
  if (giftCard.status === 'ACTIVE') {
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'REVOKED' },
    });
  }

  // Create refund transaction
  await prisma.transaction.create({
    data: {
      guestEmail: giftCard.purchasedByEmail,
      type: 'REFUND',
      amount: giftCard.amount,
      currency: giftCard.currency,
      status: 'COMPLETED',
      stripeRefundId: charge.id,
      giftCardId: giftCard.id,
      completedAt: new Date(),
    },
  });
}
