// lib/stripe/payment-succeeded.ts
// Fulfilment for a succeeded PaymentIntent: the direct-sale path and the
// partner path (gift card + redeem + hold + payment.succeeded webhook).
//
// These used to live inside the Stripe webhook route, which made them
// callable from exactly one place: a live delivery from Stripe. When a
// delivery was lost — and the route's idempotency claim meant a handler
// that threw mid-way lost every retry too — there was no way to run the
// fulfilment again. A customer whose intent succeeded on 19 October had the
// charge taken and nothing issued, and the only evidence was a
// PendingPartnerPayment row stuck at PENDING. Now the webhook and the
// reconciler below call the same code.

import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { placeHold } from '@/lib/credits/holds';
import { sendWebhook } from '@/lib/partner/webhook';

/**
 * Handle PaymentIntent succeeded - fallback for when frontend confirmation fails
 * This ensures transactions are completed even if the user's browser closes
 * Also handles partner-initiated payments with auto gift card + redeem + hold
 */
export async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
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
 * Handle partner-initiated payment (seamless payment flow)
 * Auto-creates gift card, redeems to balance, places hold, and sends webhook
 */
export async function handlePartnerPaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
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

    // 6. Update pending payment with final status.
    //
    // On the hosted-checkout flow the backer's own browser reaches us, so the
    // session row may hold their real IP. The complete endpoint copies it
    // across, but this record can be written after that call, so pick it up
    // here too rather than losing it to ordering.
    const hostedSession = await prisma.checkoutSession.findUnique({
      where: { paymentIntentId: paymentIntent.id },
      select: { customerIpAddress: true, customerUserAgent: true },
    }).catch(() => null);

    await prisma.pendingPartnerPayment.update({
      where: { paymentIntentId: paymentIntent.id },
      data: {
        status: 'COMPLETED',
        holdId,
        completedAt: new Date(),
        ...(hostedSession?.customerIpAddress
          ? {
              customerIpAddress: hostedSession.customerIpAddress,
              customerUserAgent: hostedSession.customerUserAgent,
            }
          : {}),
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

/**
 * Re-run fulfilment for one PaymentIntent from its live processor state.
 * Safe to call on something already fulfilled: the partner path returns at
 * once on a COMPLETED row, and the direct path keys on the Transaction's
 * own status. Only a `succeeded` intent is replayed; anything else is
 * reported and left alone.
 */
export async function replayPaymentIntentSucceeded(paymentIntentId: string): Promise<{
  paymentIntentId: string;
  liveStatus: string;
  replayed: boolean;
}> {
  const stripe = await getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') {
    return { paymentIntentId, liveStatus: pi.status, replayed: false };
  }
  await handlePaymentIntentSucceeded(pi);
  return { paymentIntentId, liveStatus: pi.status, replayed: true };
}

/**
 * Sweep partner payment records still PENDING after `olderThanMinutes` and
 * settle each against the processor:
 *
 * - succeeded → replay fulfilment (the lost-webhook case)
 * - canceled  → mark FAILED so it stops being scanned
 * - requires_payment_method with nothing ever attached, older than a day →
 *   cancel it at the processor and mark FAILED. The hosted session that
 *   could have paid it expired long ago, so it is unreachable; leaving it
 *   PENDING just means re-fetching it from Stripe every run forever.
 *
 * Anything else (processing, requires_action, a recent abandoned intent) is
 * left for a later run.
 */
export async function reconcileStuckPartnerPayments(opts: {
  olderThanMinutes?: number;
  limit?: number;
} = {}): Promise<{
  scanned: number;
  replayed: number;
  failed: number;
  more: boolean;
  results: Array<{ paymentIntentId: string; liveStatus: string; action: string }>;
}> {
  const olderThanMinutes = opts.olderThanMinutes ?? 15;
  const limit = opts.limit ?? 100;
  const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

  const rows = await prisma.pendingPartnerPayment.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) } },
    select: { paymentIntentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const stripe = await getStripeClient();
  const results: Array<{ paymentIntentId: string; liveStatus: string; action: string }> = [];
  let replayed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const pi = await stripe.paymentIntents.retrieve(row.paymentIntentId);
      if (pi.status === 'succeeded') {
        await handlePaymentIntentSucceeded(pi);
        replayed += 1;
        results.push({ paymentIntentId: row.paymentIntentId, liveStatus: pi.status, action: 'replayed' });
        logger.warn('Reconciler replayed a succeeded PaymentIntent the webhook never fulfilled', {
          paymentIntentId: row.paymentIntentId,
          createdAt: row.createdAt.toISOString(),
        });
        continue;
      }

      const neverAttempted =
        pi.status === 'requires_payment_method' && !pi.last_payment_error && !pi.payment_method;
      const abandoned = neverAttempted && Date.now() - row.createdAt.getTime() > ABANDON_AFTER_MS;

      if (pi.status === 'canceled' || abandoned) {
        if (abandoned) {
          await stripe.paymentIntents.cancel(pi.id).catch(() => { /* already canceled, or will expire */ });
        }
        await prisma.pendingPartnerPayment.updateMany({
          where: { paymentIntentId: row.paymentIntentId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
        failed += 1;
        results.push({
          paymentIntentId: row.paymentIntentId,
          liveStatus: pi.status,
          action: abandoned ? 'canceled-abandoned' : 'marked-failed',
        });
        continue;
      }

      results.push({ paymentIntentId: row.paymentIntentId, liveStatus: pi.status, action: 'left' });
    } catch (error) {
      logger.error('Reconciler failed on a PaymentIntent', { paymentIntentId: row.paymentIntentId, error });
      results.push({ paymentIntentId: row.paymentIntentId, liveStatus: 'error', action: 'error' });
    }
  }

  return { scanned: rows.length, replayed, failed, more: rows.length === limit, results };
}
