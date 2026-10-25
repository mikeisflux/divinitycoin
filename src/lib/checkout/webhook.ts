// lib/checkout/webhook.ts
// Dispatches checkout.* webhooks to partners when a hosted CheckoutSession
// reaches a terminal state. Idempotent — uses CheckoutSession.webhookFiredAt
// as the guard so the event fires at most once regardless of which code
// path made the session terminal (the /complete endpoint, the page's
// self-heal on load, or get-checkout-session's self-heal during polling).

import { prisma } from '@/lib/db';
import { sendWebhook } from '@/lib/partner/webhook';
import { logger } from '@/lib/logger';

export type CheckoutWebhookEvent =
  | 'checkout.completed'
  | 'checkout.failed'
  | 'checkout.expired'
  | 'checkout.canceled';

function eventForStatus(status: string): CheckoutWebhookEvent | null {
  switch (status) {
    case 'COMPLETE': return 'checkout.completed';
    case 'FAILED':   return 'checkout.failed';
    case 'EXPIRED':  return 'checkout.expired';
    case 'CANCELED': return 'checkout.canceled';
    default:         return null;
  }
}

/**
 * Fire the terminal-state webhook for a CheckoutSession if it hasn't
 * already been fired and the session is in a terminal state.
 *
 * Pass `sessionId` as the internal cuid (not the public sessionToken).
 * Safe to call multiple times — the first call wins via webhookFiredAt.
 */
export async function fireCheckoutWebhookIfNeeded(sessionId: string): Promise<void> {
  const session = await prisma.checkoutSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return;

  const eventType = eventForStatus(session.status);
  if (!eventType) return; // still pending or unknown status

  if (session.webhookFiredAt) {
    // Already fired something. Normally that is the end of it — one
    // terminal event per session. The exception is completion: a session
    // can be marked terminal and then genuinely be paid, in which case the
    // partner has been told the wrong thing and must still hear
    // checkout.completed. Only completion may supersede, and only once.
    if (session.webhookFiredEvent === eventType) return;
    if (eventType !== 'checkout.completed') return;
  }

  const partner = await prisma.partner.findUnique({
    where: { id: session.partnerId },
    select: { webhookUrl: true, webhookSecret: true, webhookEvents: true },
  });

  // No webhook configured — mark fired so we stop checking.
  if (!partner?.webhookUrl || !partner?.webhookSecret) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { webhookFiredAt: new Date(), webhookFiredEvent: eventType },
    });
    return;
  }

  // Respect per-event allowlist (empty list = all events).
  const subscribed = partner.webhookEvents || [];
  if (subscribed.length > 0 && !subscribed.includes(eventType)) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { webhookFiredAt: new Date(), webhookFiredEvent: eventType },
    });
    return;
  }

  // A pledge can sit behind several sessions — a partner that created one
  // per mount before idempotencyKey existed, or one that still does. When a
  // sibling was paid and this session was not, this expired/failed/canceled
  // event is about an abandoned attempt, not the pledge, and a partner
  // keying on pledgeId cannot tell. Say so, the way payment.failed does.
  // On checkout.completed the same flag means the pledge was paid twice.
  let pledgeAlreadyPaid = false;
  let paidPaymentIntentId: string | null = null;
  let paidSessionId: string | null = null;
  if (session.pledgeId) {
    const paid = await prisma.pendingPartnerPayment.findFirst({
      where: {
        partnerId: session.partnerId,
        pledgeId: session.pledgeId,
        status: 'COMPLETED',
        ...(session.paymentIntentId
          ? { paymentIntentId: { not: session.paymentIntentId } }
          : {}),
      },
      select: { paymentIntentId: true },
      orderBy: { createdAt: 'desc' },
    });
    if (paid) {
      pledgeAlreadyPaid = true;
      paidPaymentIntentId = paid.paymentIntentId;
      const paidSession = await prisma.checkoutSession.findUnique({
        where: { paymentIntentId: paid.paymentIntentId },
        select: { sessionToken: true },
      });
      paidSessionId = paidSession?.sessionToken ?? null;
    }
  }

  const result = await sendWebhook(
    partner.webhookUrl,
    partner.webhookSecret,
    eventType,
    {
      sessionId: session.sessionToken,
      mode: session.mode.toLowerCase(),
      partnerId: session.partnerId,
      platformUserId: session.platformUserId,
      email: session.email,
      amount: session.amount,
      currency: session.currency,
      pledgeId: session.pledgeId,
      projectId: session.projectId,
      paymentIntentId: session.paymentIntentId,
      setupIntentId: session.setupIntentId,
      paymentMethodId: session.paymentMethodId,
      status: session.status.toLowerCase(),
      completedAt: session.completedAt?.toISOString() ?? null,
      // Additive. Consumers that ignore them are unaffected.
      pledgeAlreadyPaid,
      paidPaymentIntentId,
      paidSessionId,
    },
  );

  // Mark fired regardless of HTTP result — partners get at-least-once
  // via their own retry semantics on the receiving side; we don't
  // double-deliver from here.
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: { webhookFiredAt: new Date(), webhookFiredEvent: eventType },
  });

  if (!result.success) {
    logger.warn('Checkout webhook delivery failed', {
      sessionId: session.sessionToken,
      eventType,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      error: result.error,
    });
  } else {
    logger.info('Checkout webhook delivered', {
      sessionId: session.sessionToken,
      eventType,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
    });
  }
}
