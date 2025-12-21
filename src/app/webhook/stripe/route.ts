// app/webhook/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
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
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
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
    console.error('Missing metadata in checkout session');
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
      console.error('Failed to send gift card email:', error);
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
    console.error('Gift card not found for refund:', paymentIntentId);
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
      guestEmail: giftCard.purchaseEmail,
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
