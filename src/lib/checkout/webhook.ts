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
  if (session.webhookFiredAt) return; // already fired or deliberately skipped

  const eventType = eventForStatus(session.status);
  if (!eventType) return; // still pending or unknown status

  const partner = await prisma.partner.findUnique({
    where: { id: session.partnerId },
    select: { webhookUrl: true, webhookSecret: true, webhookEvents: true },
  });

  // No webhook configured — mark fired so we stop checking.
  if (!partner?.webhookUrl || !partner?.webhookSecret) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { webhookFiredAt: new Date() },
    });
    return;
  }

  // Respect per-event allowlist (empty list = all events).
  const subscribed = partner.webhookEvents || [];
  if (subscribed.length > 0 && !subscribed.includes(eventType)) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { webhookFiredAt: new Date() },
    });
    return;
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
    },
  );

  // Mark fired regardless of HTTP result — partners get at-least-once
  // via their own retry semantics on the receiving side; we don't
  // double-deliver from here.
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: { webhookFiredAt: new Date() },
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
