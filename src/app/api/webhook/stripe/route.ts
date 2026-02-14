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
import { placeHold } from '@/lib/credits/holds';
import { sendWebhook } from '@/lib/partner/webhook';

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
 * Also handles partner-initiated payments with auto gift card + redeem + hold
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Check if this is a partner-initiated payment (seamless payment flow)
  // Handles both initial payments and upcharges
  if (paymentIntent.metadata?.type === 'partner_payment' || paymentIntent.metadata?.type === 'partner_upcharge') {
    await handlePartnerPaymentSucceeded(paymentIntent);
    return;
  }

  const transactionId = paymentIntent.metadata?.transactionId;

  if (!transactionId) {
    logger.debug('PaymentIntent succeeded without transactionId metadata', {
      paymentIntentId: paymentIntent.id
    });
    return;
  }

  // Small delay to let frontend payment-confirm handle it first
  // This reduces race conditions without breaking the fallback mechanism
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Find the transaction (after delay, to see if frontend already completed it)
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

  // If already completed, nothing to do (frontend likely handled it)
  if (transaction.status === 'COMPLETED' && transaction.giftCard) {
    logger.debug('Transaction already completed (frontend handled it)', { transactionId });
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
  const rawPartnerId = paymentIntent.metadata?.partnerId || null;

  // Validate partnerId exists in database (empty strings or non-existent IDs cause FK violations)
  let partnerId: string | null = null;
  if (rawPartnerId && rawPartnerId.trim() !== '') {
    const partnerExists = await prisma.partner.findUnique({
      where: { id: rawPartnerId },
      select: { id: true },
    });
    if (partnerExists) {
      partnerId = rawPartnerId;
    } else {
      logger.warn('Partner ID from webhook metadata not found in database', {
        rawPartnerId,
        transactionId,
      });
    }
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      // Write conflict (P2034) - expected race condition with frontend payment-confirm
      // Check if transaction was completed by the other request
      const existingTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { giftCard: true },
      });

      if (existingTransaction?.status === 'COMPLETED' && existingTransaction.giftCard) {
        // Frontend completed it first - this is normal and expected
        logger.debug('Transaction completed by frontend during webhook (race resolved)', { transactionId });
        return;
      }

      // Not yet completed - Stripe will retry the webhook
      logger.debug('Transaction conflict, awaiting retry', { transactionId });
      return;
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

  try {
    // Use a transaction to ensure atomicity and handle race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if gift card is already active (idempotency check)
      const existingGiftCard = await tx.giftCard.findUnique({
        where: { id: giftCardId },
      });

      if (!existingGiftCard) {
        logger.warn('Gift card not found for checkout session', { giftCardId, sessionId: session.id });
        return null;
      }

      // If already active, this webhook was already processed
      if (existingGiftCard.status === 'ACTIVE') {
        logger.info('Gift card already active, skipping duplicate webhook', { giftCardId });
        return { giftCard: existingGiftCard, alreadyProcessed: true };
      }

      // Update gift card status to ACTIVE
      const giftCard = await tx.giftCard.update({
        where: { id: giftCardId },
        data: {
          status: 'ACTIVE',
          stripePaymentIntentId: session.payment_intent as string,
        },
      });

      // Update transaction status
      await tx.transaction.updateMany({
        where: { stripeCheckoutSessionId: session.id },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: session.payment_intent as string,
          completedAt: new Date(),
        },
      });

      return { giftCard, alreadyProcessed: false };
    }, {
      timeout: 10000,
    });

    if (!result) return;

    // Send gift card email only if this is the first processing
    if (!result.alreadyProcessed && session.customer_email) {
      try {
        await sendGiftCardEmail({
          to: session.customer_email,
          code: giftCardCode,
          amount: Number(result.giftCard.amount),
        });
      } catch (error) {
        logger.error('Failed to send gift card email', { error, giftCardId });
      }
    }
  } catch (error) {
    // Handle write conflicts gracefully - Stripe will retry
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      logger.warn('Transaction conflict in handleSuccessfulPayment, checking for existing gift card', {
        giftCardId,
        errorCode: error.code,
      });

      // Check if already processed
      const existingGiftCard = await prisma.giftCard.findUnique({
        where: { id: giftCardId },
      });

      if (existingGiftCard?.status === 'ACTIVE') {
        logger.info('Transaction already processed, returning existing gift card', {
          giftCardId,
        });
        return;
      }

      // Not yet completed - will be retried by Stripe
      throw error;
    }
    throw error;
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

  try {
    await prisma.$transaction(async (tx) => {
      // Check if gift card exists and is still pending
      const existingGiftCard = await tx.giftCard.findUnique({
        where: { id: giftCardId },
      });

      // Only delete if still in PENDING status - if ACTIVE, payment succeeded
      if (existingGiftCard && existingGiftCard.status === 'PENDING') {
        await tx.giftCard.delete({
          where: { id: giftCardId },
        });
      }

      // Update transaction status
      await tx.transaction.updateMany({
        where: {
          stripeCheckoutSessionId: session.id,
          status: 'PENDING', // Only update pending transactions
        },
        data: {
          status: 'FAILED',
          failureReason: 'Checkout session expired',
        },
      });
    }, {
      timeout: 10000,
    });
  } catch (error) {
    // Handle gracefully - expired session cleanup is not critical
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.debug('Error cleaning up expired session (non-critical)', {
        sessionId: session.id,
        giftCardId,
        errorCode: error.code,
      });
      return;
    }
    throw error;
  }
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

/**
 * Handle partner-initiated payment (seamless payment flow)
 * Auto-creates gift card, redeems to balance, places hold, and sends webhook
 */
async function handlePartnerPaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { partnerId, platformUserId, pledgeId, projectId, email } = paymentIntent.metadata;

  if (!partnerId || !platformUserId || !pledgeId || !projectId) {
    logger.error('Partner payment missing required metadata', {
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });
    return;
  }

  // Check if already processed
  const existingPayment = await prisma.pendingPartnerPayment.findUnique({
    where: { paymentIntentId: paymentIntent.id },
  });

  if (existingPayment?.status === 'COMPLETED') {
    logger.debug('Partner payment already processed', { paymentIntentId: paymentIntent.id });
    return;
  }

  const amountDollars = paymentIntent.amount / 100;

  try {
    // Generate gift card code
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);

    let giftCardId: string;
    let holdId: string | undefined;

    // Use a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Create gift card
      const giftCard = await tx.giftCard.create({
        data: {
          codeHash,
          codeLast4,
          amount: amountDollars,
          currency: 'USD',
          status: 'REDEEMED', // Immediately redeemed
          purchasedByEmail: email,
          activatedAt: new Date(),
          redeemedAt: new Date(),
          redeemedByPlatformUserId: platformUserId,
          redeemedOnPlatform: partnerId,
          partnerId,
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      giftCardId = giftCard.id;

      // 2. Upsert credit balance (auto-redeem)
      const creditBalance = await tx.creditBalance.upsert({
        where: { platformUserId },
        create: {
          platformUserId,
          email,
          availableBalance: amountDollars,
          heldBalance: 0,
        },
        update: {
          availableBalance: { increment: amountDollars },
        },
      });

      // 3. Create ledger entry for redemption
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'REDEMPTION',
          amount: amountDollars,
          balanceAfter: creditBalance.availableBalance,
          giftCardId: giftCard.id,
          description: `Auto-redeemed gift card ****${codeLast4} from partner payment`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            partnerId,
            pledgeId,
            projectId,
            autoRedeemed: true,
          },
        },
      });

      // 4. Update pending payment record
      await tx.pendingPartnerPayment.update({
        where: { paymentIntentId: paymentIntent.id },
        data: {
          giftCardId: giftCard.id,
          status: 'PROCESSING',
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    });

    // 5. Place hold (after transaction to avoid nested transactions)
    const holdResult = await placeHold({
      platformUserId,
      amount: amountDollars,
      pledgeId,
      projectId,
      ipAddress: '0.0.0.0', // Webhook has no client IP
    });

    if (holdResult.success) {
      holdId = holdResult.holdId;
    } else {
      logger.error('Failed to place hold after partner payment', {
        paymentIntentId: paymentIntent.id,
        error: holdResult.error,
      });
    }

    // 6. Update pending payment with final status
    await prisma.pendingPartnerPayment.update({
      where: { paymentIntentId: paymentIntent.id },
      data: {
        status: 'COMPLETED',
        holdId,
        completedAt: new Date(),
      },
    });

    // 7. Send webhook to partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { webhookUrl: true, webhookSecret: true },
    });

    if (partner?.webhookUrl && partner?.webhookSecret) {
      // Get payment method details from Stripe
      let paymentMethodDetails = { type: 'card', brand: 'unknown', last4: '****' };
      if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'string') {
        try {
          const stripe = await getStripeClient();
          const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
          if (pm.card) {
            paymentMethodDetails = {
              type: 'card',
              brand: pm.card.brand || 'unknown',
              last4: pm.card.last4 || '****',
            };
          }
        } catch {
          // Use defaults if retrieval fails
        }
      }

      const isUpcharge = paymentIntent.metadata?.type === 'partner_upcharge';

      const webhookResult = await sendWebhook(partner.webhookUrl, partner.webhookSecret, 'payment.succeeded', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        platformUserId,
        pledgeId,
        projectId,
        type: isUpcharge ? 'upcharge' : 'initial',
        ...(isUpcharge && paymentIntent.metadata?.originalPaymentId
          ? { originalPaymentId: paymentIntent.metadata.originalPaymentId }
          : {}),
        giftCard: {
          last4: codeLast4,
          amount: paymentIntent.amount,
          autoRedeemed: true,
        },
        hold: holdId ? {
          holdId,
          amount: paymentIntent.amount,
          status: 'ACTIVE',
        } : null,
        paymentMethod: paymentMethodDetails,
      });

      // Update webhook sent status
      await prisma.pendingPartnerPayment.update({
        where: { paymentIntentId: paymentIntent.id },
        data: {
          webhookSent: webhookResult.success,
          webhookSentAt: new Date(),
        },
      });

      if (!webhookResult.success) {
        logger.warn('Failed to send webhook to partner', {
          paymentIntentId: paymentIntent.id,
          partnerId,
          error: webhookResult.error,
        });
      }
    }

    logger.info('Partner payment processed successfully', {
      paymentIntentId: paymentIntent.id,
      partnerId,
      platformUserId,
      amount: amountDollars,
      holdId,
    });
  } catch (error) {
    logger.error('Failed to process partner payment', {
      error,
      paymentIntentId: paymentIntent.id,
    });

    // Update status to failed
    await prisma.pendingPartnerPayment.update({
      where: { paymentIntentId: paymentIntent.id },
      data: { status: 'FAILED' },
    }).catch(() => {});

    // Send failure webhook to partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { webhookUrl: true, webhookSecret: true },
    });

    if (partner?.webhookUrl && partner?.webhookSecret) {
      await sendWebhook(partner.webhookUrl, partner.webhookSecret, 'payment.failed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        platformUserId,
        pledgeId,
        projectId,
        error: 'Payment processing failed',
      });
    }

    throw error;
  }
}
