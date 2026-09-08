// lib/partner/dispute-webhook.ts
// Notifies a partner when a cardholder disputes one of their charges, so the
// order can be pulled from fulfillment before goods ship.
//
// A dispute is raised against a *charge*, not against an order, so unlike the
// payment.* events there is no partner metadata to read: Stripe's Dispute
// object carries none. The partner is resolved by looking the PaymentIntent up
// in PendingPartnerPayment, which is also what tells us whether the charge
// belongs to a partner at all — DC settles marketplace and direct sales on the
// same Stripe account, and those must not be reported to anyone.

import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { sendWebhook } from '@/lib/partner/webhook';
import { logger } from '@/lib/logger';

export const DISPUTE_CREATED_EVENT = 'dispute.created';

/**
 * Delivery attempts, including the first. The receiving handler is documented
 * as idempotent (compare-and-swap on the pledge status), so a redelivery
 * cannot double-decrement a campaign total — which is what makes retrying
 * safe here. Kept local rather than added to sendWebhook so the behaviour of
 * every existing event stays exactly as it is.
 */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [1_000, 3_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type DisputeNotifyOutcome =
  | { delivered: true; partnerId: string; pledgeId: string; attempts: number }
  | { delivered: false; reason: string; partnerId?: string; attempts?: number };

/**
 * Resolve the PaymentIntent id a dispute was raised against.
 *
 * `dispute.payment_intent` is normally populated, but it is nullable and on
 * some events arrives expanded rather than as an id. When it is missing
 * entirely we fall back to the charge, which always has one for card charges.
 */
async function resolvePaymentIntentId(dispute: Stripe.Dispute): Promise<string | null> {
  if (typeof dispute.payment_intent === 'string') return dispute.payment_intent;
  if (dispute.payment_intent && typeof dispute.payment_intent === 'object') {
    return dispute.payment_intent.id;
  }

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;

  try {
    const stripe = await getStripeClient();
    const charge = await stripe.charges.retrieve(chargeId);
    if (typeof charge.payment_intent === 'string') return charge.payment_intent;
    return charge.payment_intent?.id ?? null;
  } catch (error) {
    logger.error('Could not resolve payment intent for dispute', {
      disputeId: dispute.id,
      chargeId,
      error,
    });
    return null;
  }
}

/**
 * Fire `dispute.created` to the partner that owns the disputed charge.
 *
 * Returns rather than throws for every "nothing to do" case — a dispute on a
 * non-partner charge is normal, not an error, and must not fail the Stripe
 * webhook and trigger a pointless Stripe-side retry.
 */
export async function notifyPartnerOfDispute(
  dispute: Stripe.Dispute,
): Promise<DisputeNotifyOutcome> {
  const paymentIntentId = await resolvePaymentIntentId(dispute);
  if (!paymentIntentId) {
    return { delivered: false, reason: 'no_payment_intent' };
  }

  const record = await prisma.pendingPartnerPayment.findUnique({
    where: { paymentIntentId },
    select: {
      id: true,
      partnerId: true,
      pledgeId: true,
      projectId: true,
      platformUserId: true,
    },
  });

  // Not a partner charge — a marketplace or direct sale. Nothing to report.
  if (!record) {
    logger.info('Dispute on a non-partner charge, no webhook sent', {
      disputeId: dispute.id,
      paymentIntentId,
    });
    return { delivered: false, reason: 'not_a_partner_charge' };
  }

  const partner = await prisma.partner.findUnique({
    where: { id: record.partnerId },
    select: { webhookUrl: true, webhookSecret: true, webhookEvents: true },
  });

  if (!partner?.webhookUrl || !partner?.webhookSecret) {
    logger.warn('Dispute on a partner charge but partner has no webhook configured', {
      disputeId: dispute.id,
      paymentIntentId,
      partnerId: record.partnerId,
    });
    return { delivered: false, reason: 'no_webhook_configured', partnerId: record.partnerId };
  }

  // Per-event allowlist, same convention as checkout.* and settlement events:
  // an empty list means the partner takes everything.
  const subscribed = partner.webhookEvents || [];
  if (subscribed.length > 0 && !subscribed.includes(DISPUTE_CREATED_EVENT)) {
    return { delivered: false, reason: 'not_subscribed', partnerId: record.partnerId };
  }

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;
  const dueBy = dispute.evidence_details?.due_by;

  const payload = {
    disputeId: dispute.id,
    stripePaymentIntentId: paymentIntentId,
    chargeId,
    pledgeId: record.pledgeId,
    projectId: record.projectId,
    platformUserId: record.platformUserId,
    paymentId: record.id,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    evidenceDueBy: dueBy ? new Date(dueBy * 1000).toISOString() : null,
  };

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await sendWebhook(
      partner.webhookUrl,
      partner.webhookSecret,
      DISPUTE_CREATED_EVENT,
      payload,
    );

    if (result.success) {
      logger.info('Partner dispute.created delivered', {
        disputeId: dispute.id,
        paymentIntentId,
        partnerId: record.partnerId,
        pledgeId: record.pledgeId,
        reason: dispute.reason,
        attempt,
      });
      return {
        delivered: true,
        partnerId: record.partnerId,
        pledgeId: record.pledgeId,
        attempts: attempt,
      };
    }

    lastError = result.error ?? `HTTP ${result.statusCode}`;
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS[attempt - 1] ?? 3_000);
  }

  // Loud on final failure: an undelivered dispute means the partner keeps
  // shipping goods for money that is already being clawed back, which is the
  // exact failure this event exists to prevent.
  logger.error('Partner dispute.created delivery failed after retries', {
    disputeId: dispute.id,
    paymentIntentId,
    partnerId: record.partnerId,
    pledgeId: record.pledgeId,
    attempts: MAX_ATTEMPTS,
    error: lastError,
  });
  return {
    delivered: false,
    reason: `delivery_failed: ${lastError}`,
    partnerId: record.partnerId,
    attempts: MAX_ATTEMPTS,
  };
}
