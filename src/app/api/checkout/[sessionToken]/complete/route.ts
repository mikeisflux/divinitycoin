// app/api/checkout/[sessionToken]/complete/route.ts
// Server-side completion endpoint for the DC-hosted checkout page.
// Authoritatively verifies the underlying PaymentIntent status with
// the processor before flipping the CheckoutSession to a terminal
// state. The client never gets to dictate the result.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { fireCheckoutWebhookIfNeeded } from '@/lib/checkout/webhook';

function appendSessionId(url: string, sessionToken: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('session_id', sessionToken);
    return u.toString();
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ sessionToken: string }> }) {
  const params = await props.params;
  const { sessionToken } = params;

  // This request comes from the backer's own browser, so the forwarded address
  // is theirs — unlike the server-to-server endpoints, where it is the
  // partner's datacenter. It is the only point in the hosted flow where we can
  // observe the purchaser directly, and it is what a non-authorisation dispute
  // turns on.
  const customerIpAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    null;
  const customerUserAgent = req.headers.get('user-agent')?.slice(0, 512) || null;

  try {
    const session = await prisma.checkoutSession.findUnique({
      where: { sessionToken },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // If we already marked it terminal, just hand back the redirect
    // (idempotent — the client may call this twice, e.g. once after
    // confirmPayment and again after a 3DS redirect).
    if (session.status !== 'PENDING') {
      const target =
        session.status === 'COMPLETE'
          ? session.returnUrl
          : (session.cancelUrl ?? session.returnUrl);
      return NextResponse.json({
        success: true,
        status: session.status.toLowerCase(),
        redirectUrl: target ? appendSessionId(target, sessionToken) : null,
      });
    }

    // Lazy expire if the user took too long.
    if (session.expiresAt < new Date()) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      await fireCheckoutWebhookIfNeeded(session.id);
      const target = session.cancelUrl ?? session.returnUrl;
      return NextResponse.json({
        success: true,
        status: 'expired',
        redirectUrl: target ? appendSessionId(target, sessionToken) : null,
      });
    }

    if (!session.paymentIntentId && !session.setupIntentId) {
      return NextResponse.json({ error: 'Session has no intent' }, { status: 500 });
    }

    // Authoritative status from the processor — works for both PI and
    // SI sessions. Status mapping is identical: succeeded → COMPLETE,
    // canceled → CANCELED, requires_payment_method → FAILED, everything
    // else (requires_action, processing) stays PENDING.
    const stripe = await getStripeClient();

    let nextStatus: 'COMPLETE' | 'FAILED' | 'CANCELED' | 'PENDING' = 'PENDING';
    let paymentMethodId: string | null = null;
    let processorStatus: string;

    if (session.paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(session.paymentIntentId);
      processorStatus = pi.status;
      if (pi.status === 'succeeded') {
        nextStatus = 'COMPLETE';
        paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : null;
      } else if (pi.status === 'canceled') {
        nextStatus = 'CANCELED';
      } else if (pi.status === 'requires_payment_method') {
        nextStatus = 'FAILED';
      }
    } else {
      const si = await stripe.setupIntents.retrieve(session.setupIntentId!);
      processorStatus = si.status;
      if (si.status === 'succeeded') {
        nextStatus = 'COMPLETE';
        paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : null;
      } else if (si.status === 'canceled') {
        nextStatus = 'CANCELED';
      } else if (si.status === 'requires_payment_method') {
        nextStatus = 'FAILED';
      }
    }

    if (nextStatus === 'PENDING') {
      // Still in flight (requires_action / processing) — don't flip yet.
      return NextResponse.json({
        success: true,
        status: 'pending',
        processorStatus,
      });
    }

    const completedAt = nextStatus === 'COMPLETE' ? new Date() : null;

    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        completedAt,
        paymentMethodId,
        customerIpAddress,
        customerUserAgent,
      },
    });

    // Carry it onto the payment record, which is what the evidence bundle
    // reads. updateMany rather than update: the row is created by the Stripe
    // webhook, which may not have landed yet, and a missing row here must not
    // fail the customer's checkout.
    if (session.paymentIntentId && customerIpAddress) {
      await prisma.pendingPartnerPayment
        .updateMany({
          where: { paymentIntentId: session.paymentIntentId },
          data: { customerIpAddress, customerUserAgent },
        })
        .catch(() => { /* best-effort; the session row still holds it */ });
    }

    // Fire the partner's checkout.* webhook (idempotent — no-op if
    // already fired by a different code path).
    await fireCheckoutWebhookIfNeeded(session.id);

    const target =
      nextStatus === 'COMPLETE'
        ? session.returnUrl
        : (session.cancelUrl ?? session.returnUrl);

    logger.info('Hosted checkout: session completed', {
      sessionId: sessionToken,
      partnerId: session.partnerId,
      mode: session.mode,
      status: nextStatus,
      paymentIntentId: session.paymentIntentId,
      setupIntentId: session.setupIntentId,
    });

    return NextResponse.json({
      success: true,
      status: nextStatus.toLowerCase(),
      redirectUrl: target ? appendSessionId(target, sessionToken) : null,
    });
  } catch (error) {
    logger.error('Hosted checkout: complete endpoint failed', {
      sessionToken,
      error,
    });
    return NextResponse.json({ error: 'Failed to finalize checkout' }, { status: 500 });
  }
}
