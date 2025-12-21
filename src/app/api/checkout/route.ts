// app/api/checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';

// Constants
const PRESET_AMOUNTS = [10, 25, 50, 100, 250];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CheckoutRequest {
  amount: number;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();
    const { amount, email } = body;

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}` },
        { status: 400 }
      );
    }

    // Validate email
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Generate gift card code (not yet activated)
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);

    // Create pending gift card record
    const giftCard = await prisma.giftCard.create({
      data: {
        codeHash,
        codeLast4,
        amount,
        currency: 'USD',
        status: 'PENDING',
        purchasedByEmail: email,
      },
    });

    // Create Stripe checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100), // Convert to cents
            product_data: {
              name: 'CreatorCredits',
              description: `$${amount.toFixed(2)} in credits`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancelled`,
      metadata: {
        giftCardId: giftCard.id,
        giftCardCode: code, // Stored temporarily in Stripe metadata
      },
    });

    // Update gift card with session ID
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        stripeCheckoutSessionId: session.id,
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        guestEmail: email,
        type: 'PURCHASE',
        amount,
        currency: 'USD',
        status: 'PENDING',
        stripeCheckoutSessionId: session.id,
        giftCardId: giftCard.id,
      },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
