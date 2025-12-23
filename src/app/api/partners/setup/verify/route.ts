// app/api/partners/setup/verify/route.ts
// Verify partner setup token and return partner info

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

    // SECURITY: Use same error response for all token validation failures
    // This prevents enumeration of valid tokens via different status codes
    if (!partner) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const settings = partner.settings as Record<string, unknown> | null;

    // Check if token is expired - use same error message
    if (settings?.setupTokenExpires && new Date(settings.setupTokenExpires as string) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // Check if fully set up (onboarding complete) - use same error message
    if (partner.onboardingComplete) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
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
    logger.apiError('/api/partners/setup/verify', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
