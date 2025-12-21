// app/api/stripe-config/route.ts
// Returns the Stripe publishable key for the frontend

import { NextResponse } from 'next/server';
import { getStripeConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = await getStripeConfig();

    if (!config.publishableKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      publishableKey: config.publishableKey,
    });
  } catch (error) {
    console.error('Failed to get Stripe config:', error);
    return NextResponse.json(
      { error: 'Failed to load payment configuration' },
      { status: 500 }
    );
  }
}
