// app/api/partners/setup/verify/route.ts
// Verify partner setup token and return partner info

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Find partner with this setup token
    const partner = await prisma.partner.findFirst({
      where: {
        settings: {
          path: ['setupToken'],
          equals: token,
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Invalid setup token' }, { status: 404 });
    }

    const settings = partner.settings as Record<string, unknown> | null;

    // Check if token is expired
    if (settings?.setupTokenExpires && new Date(settings.setupTokenExpires as string) < new Date()) {
      return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 });
    }

    // Check if fully set up (onboarding complete)
    if (partner.onboardingComplete) {
      return NextResponse.json({ error: 'Account already set up. Please login.' }, { status: 409 });
    }

    // Return partner info for onboarding form pre-fill
    return NextResponse.json({
      name: partner.name,
      email: partner.contactEmail,
      contactName: partner.contactName,
      website: partner.website,
      description: partner.description,
      currentStep: partner.onboardingStep,
    });
  } catch (error) {
    console.error('Failed to verify setup token:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
