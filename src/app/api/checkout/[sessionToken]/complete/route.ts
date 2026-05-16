// app/api/checkout/[sessionToken]/complete/route.ts
// Server-side completion endpoint for the DC-hosted checkout page.
// Authoritatively verifies the underlying PaymentIntent status with
// the processor before flipping the CheckoutSession to a terminal
// state. The client never gets to dictate the result.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { logger } from '@/lib/logger';

function appendSessionId(url: string, sessionToken: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('session_id', sessionToken);
    return u.toString();
  } catch {
    return url;
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { sessionToken: string } },
) {
  const { sessionToken } = params;

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
      },
    });

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
