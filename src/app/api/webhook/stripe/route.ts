// app/webhook/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getStripeClient, getWebhookSecret } from '@/lib/stripe';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { sendWebhook } from '@/lib/partner/webhook';
import { notifyPartnerOfDispute } from '@/lib/partner/dispute-webhook';
import { handlePaymentIntentSucceeded } from '@/lib/stripe/payment-succeeded';

// Uses headers() / raw body; never pre-render during build.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Set once this delivery owns the event id; released if processing fails.
  let claimedEventId: string | null = null;
  try {
    const body = await request.text();
    const headersList = await headers();
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

    // Idempotency: Stripe retries events on failure and can deliver the same
    // event.id multiple times. Attempt to record the event first; if the
    // unique constraint on eventId fires, we've already processed it.
    try {
      await prisma.stripeWebhookEvent.create({
        data: { eventId: event.id, eventType: event.type },
      });
      claimedEventId = event.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.debug('Stripe webhook already processed, skipping', {
          eventId: event.id,
          eventType: event.type,
        });
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.requires_action':
        await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
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

      // A cardholder disputed a charge. Told to the partner immediately so the
      // order leaves fulfillment before anything ships. Requires
      // charge.dispute.created to be enabled on the Stripe endpoint.
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.apiError('/webhook/stripe', error);

    // The claim above was taken before processing, so without this a
    // handler that throws leaves the event id recorded as handled. Stripe
    // does retry on the 500 we return — and every retry then hit the unique
    // constraint and was discarded as a duplicate. That is how a succeeded
    // payment on 19 October was charged and never fulfilled: the handler
    // died mid-way, and nothing could ever run it again. Release the claim
    // so the retry is processed as a first delivery.
    if (claimedEventId) {
      await prisma.stripeWebhookEvent
        .delete({ where: { eventId: claimedEventId } })
        .catch((releaseError) => {
          logger.error('Failed to release webhook idempotency claim', {
            eventId: claimedEventId,
            error: releaseError,
          });
        });
    }

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
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
 * Notify the partner when one of their PaymentIntents has transitioned
 * into the requires_action state — i.e., the cardholder needs to
 * complete SCA / 3DS before the charge can proceed. Most actionable for
 * partners using charge-saved-payment-method off-session, who otherwise
 * have to react to the requires_action result synchronously and may have
 * missed it (server crash, network blip, etc.). Hosted-checkout PIs
 * also pass through here, but in that flow we drive the challenge on
 * our own page so the event is informational rather than actionable
 * for the partner.
 *
 * Same envelope and signature as other partner webhooks. Includes
 * client_secret so partners can mount Stripe.js with it and let the
 * cardholder complete the challenge on their side when needed.
 */
async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  // Only partner-initiated payments
  if (
    paymentIntent.metadata?.type !== 'partner_payment' &&
    paymentIntent.metadata?.type !== 'partner_upcharge'
  ) {
    return;
  }

  const partnerId = paymentIntent.metadata.partnerId;
  const platformUserId = paymentIntent.metadata.platformUserId;
  const pledgeId = paymentIntent.metadata.pledgeId;
  const projectId = paymentIntent.metadata.projectId;

  if (!partnerId) {
    logger.warn('PaymentIntent.requires_action with no partnerId metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { webhookUrl: true, webhookSecret: true },
  });
  if (!partner?.webhookUrl || !partner?.webhookSecret) return;

  const isUpcharge = paymentIntent.metadata?.type === 'partner_upcharge';

  await sendWebhook(partner.webhookUrl, partner.webhookSecret, 'payment.requires_action', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    platformUserId,
    pledgeId,
    projectId,
    type: isUpcharge ? 'upcharge' : 'initial',
    clientSecret: paymentIntent.client_secret,
    nextActionType: paymentIntent.next_action?.type ?? null,
  });

  logger.info('Partner payment.requires_action delivered', {
    paymentIntentId: paymentIntent.id,
    partnerId,
    platformUserId,
    nextActionType: paymentIntent.next_action?.type ?? null,
  });
}

/**
 * Relay a new dispute to the partner whose charge it was raised against.
 *
 * Deliberately swallows its own failures: the notifier already retries and
 * logs, and letting an exception escape would fail the whole Stripe webhook.
 * Stripe would then redeliver the event, but our StripeWebhookEvent
 * idempotency guard has already recorded event.id, so the retry would be
 * dropped as a duplicate and every other side effect of this event would be
 * lost with it.
 */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  try {
    await notifyPartnerOfDispute(dispute);
  } catch (error) {
    logger.error('Unexpected failure handling charge.dispute.created', {
      disputeId: dispute.id,
      error,
    });
  }
}

/**
 * The card actually failed — declined, expired, insufficient funds, a failed
 * 3DS challenge.
 *
 * Distinct from the existing payment.failed that fires from the catch block in
 * handlePartnerPaymentSucceeded: that one means the charge went through and
 * *our* post-processing broke. This one means no money moved. Same event name,
 * because it is the same thing from the partner's side — the pledge did not get
 * paid — and the decline fields say which.
 *
 * Off-session declines on charge-saved-payment-method already surface
 * synchronously as a 402, so for those partners this is a second, redundant
 * signal. That is deliberate: the synchronous response is lost if their request
 * times out or their process dies mid-call, which is exactly when they most
 * need to know.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  if (
    paymentIntent.metadata?.type !== 'partner_payment' &&
    paymentIntent.metadata?.type !== 'partner_upcharge'
  ) {
    return;
  }

  const partnerId = paymentIntent.metadata.partnerId;
  const platformUserId = paymentIntent.metadata.platformUserId;
  const pledgeId = paymentIntent.metadata.pledgeId;
  const projectId = paymentIntent.metadata.projectId;

  if (!partnerId) {
    logger.warn('PaymentIntent.payment_failed with no partnerId metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const lastError = paymentIntent.last_payment_error;

  // Only PENDING moves to FAILED. A PaymentIntent can be declined and then
  // succeed on a later attempt with a different card, so a late-arriving
  // failure event must never clobber a COMPLETED record — updateMany with the
  // status in the filter makes that a no-op rather than a race.
  const updated = await prisma.pendingPartnerPayment.updateMany({
    where: { paymentIntentId: paymentIntent.id, status: 'PENDING' },
    data: { status: 'FAILED' },
  });

  // Zero rows updated means either the record is already in a terminal state —
  // nothing to do — or it does not exist yet. The latter is a real race on the
  // synchronous decline path: charge-saved-payment-method writes its tracking
  // row inside the request, and Stripe can deliver payment_intent.payment_failed
  // before that write lands. Without this, the status write is simply lost and a
  // definitively failed charge sits as PENDING forever.
  if (updated.count === 0) {
    const existing = await prisma.pendingPartnerPayment.findUnique({
      where: { paymentIntentId: paymentIntent.id },
      select: { id: true },
    });

    if (!existing && platformUserId && pledgeId && projectId) {
      const email = paymentIntent.metadata?.email;
      if (email) {
        await prisma.pendingPartnerPayment
          .create({
            data: {
              paymentIntentId: paymentIntent.id,
              partnerId,
              platformUserId,
              pledgeId,
              projectId,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              email,
              status: 'FAILED',
            },
          })
          .catch(async () => {
            // Lost the race the other way — the request path inserted first.
            // Re-apply the transition it would have missed.
            await prisma.pendingPartnerPayment
              .updateMany({
                where: { paymentIntentId: paymentIntent.id, status: 'PENDING' },
                data: { status: 'FAILED' },
              })
              .catch(() => { /* best-effort */ });
          });
      } else {
        logger.warn('payment_failed for an unrecorded intent with no email in metadata', {
          paymentIntentId: paymentIntent.id,
          partnerId,
        });
      }
    }
  }

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { webhookUrl: true, webhookSecret: true },
  });
  if (!partner?.webhookUrl || !partner?.webhookSecret) return;

  const isUpcharge = paymentIntent.metadata?.type === 'partner_upcharge';

  // A pledge can have more than one PaymentIntent behind it — a partner
  // whose checkout re-mounts creates one per attempt. When one of the
  // others has already been paid, this failure is an abandoned sibling, not
  // the pledge failing, and a partner keying on pledgeId alone cannot tell
  // the difference. Say so explicitly rather than making them infer it.
  let pledgeAlreadyPaid = false;
  let paidPaymentIntentId: string | null = null;
  if (pledgeId) {
    const paid = await prisma.pendingPartnerPayment.findFirst({
      where: {
        partnerId,
        pledgeId,
        status: 'COMPLETED',
        paymentIntentId: { not: paymentIntent.id },
      },
      select: { paymentIntentId: true },
      orderBy: { createdAt: 'desc' },
    });
    if (paid) {
      pledgeAlreadyPaid = true;
      paidPaymentIntentId = paid.paymentIntentId;
    }
  }

  await sendWebhook(partner.webhookUrl, partner.webhookSecret, 'payment.failed', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    platformUserId,
    pledgeId,
    projectId,
    type: isUpcharge ? 'upcharge' : 'initial',
    error: lastError?.message ?? 'The payment could not be completed.',
    code: lastError?.code ?? null,
    declineCode: lastError?.decline_code ?? null,
    status: paymentIntent.status,
    // New, additive. Existing consumers that ignore them are unaffected.
    pledgeAlreadyPaid,
    paidPaymentIntentId,
  });

  logger.info('Partner payment.failed delivered', {
    paymentIntentId: paymentIntent.id,
    partnerId,
    platformUserId,
    pledgeId,
    code: lastError?.code ?? null,
    declineCode: lastError?.decline_code ?? null,
    pledgeAlreadyPaid,
  });
}
