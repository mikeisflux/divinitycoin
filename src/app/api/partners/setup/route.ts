// app/api/partners/setup/route.ts
// Multi-step partner account onboarding

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

interface SetupRequest {
  token: string;
  step: 'password' | 'company' | 'banking';
  // Password step
  password?: string;
  // Company step
  contactName?: string;
  website?: string;
  description?: string;
  // Banking step
  paymentMethod?: 'ach' | 'wire' | 'paypal';
  bankName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  paypalEmail?: string;
}

async function findPartnerByToken(token: string) {
  const partner = await prisma.partner.findFirst({
    where: {
      settings: {
        path: ['setupToken'],
        equals: token,
      },
    },
  });

  // SECURITY: Use same error message for all token validation failures
  // This prevents enumeration of valid tokens
  if (!partner) {
    return { partner: null, error: 'Invalid or expired token' };
  }

  const settings = partner.settings as Record<string, unknown> | null;

  // Check if token is expired - use same error message
  if (settings?.setupTokenExpires && new Date(settings.setupTokenExpires as string) < new Date()) {
    return { partner: null, error: 'Invalid or expired token' };
  }

  return { partner, settings, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const body: SetupRequest = await request.json();
    const { token, step } = body;

    if (!token || !step) {
      return NextResponse.json(
        { error: 'Token and step are required' },
        { status: 400 }
      );
    }

    const { partner, settings, error } = await findPartnerByToken(token);

    // SECURITY: Use 400 status to prevent token enumeration via status codes
    if (error || !partner) {
      return NextResponse.json({ error: error || 'Invalid or expired token' }, { status: 400 });
    }

    // Handle each step
    switch (step) {
      case 'password': {
        const { password } = body;

        if (!password || password.length < 8) {
          return NextResponse.json(
            { error: 'Password must be at least 8 characters' },
            { status: 400 }
          );
        }

        // Check if already has password (can skip if resuming)
        if (settings?.passwordHash && partner.onboardingStep >= 1) {
          return NextResponse.json({ success: true, message: 'Password already set' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            onboardingStep: 1,
            settings: {
              ...(settings || {}),
              passwordHash,
            },
          },
        });

        return NextResponse.json({ success: true });
      }

      case 'company': {
        const { contactName, website, description } = body;

        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            contactName: contactName || partner.contactName,
            website: website || partner.website,
            description: description || partner.description,
            onboardingStep: 2,
          },
        });

        return NextResponse.json({ success: true });
      }

      case 'banking': {
        const { paymentMethod, bankName, bankRoutingNumber, bankAccountNumber, paypalEmail } = body;

        if (!paymentMethod) {
          return NextResponse.json(
            { error: 'Payment method is required' },
            { status: 400 }
          );
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {
          paymentMethod,
          onboardingStep: 4,
          onboardingComplete: true,
          settings: {
            ...(settings || {}),
            setupToken: null, // Clear token after completion
            setupTokenExpires: null,
            onboardingCompletedAt: new Date().toISOString(),
          },
        };

        if (paymentMethod === 'paypal') {
          if (!paypalEmail || !paypalEmail.includes('@')) {
            return NextResponse.json(
              { error: 'Valid PayPal email is required' },
              { status: 400 }
            );
          }
          updateData.paypalEmail = paypalEmail;
        } else {
          // ACH or Wire - requires bank details
          if (!bankName || !bankRoutingNumber || !bankAccountNumber) {
            return NextResponse.json(
              { error: 'Bank details are required' },
              { status: 400 }
            );
          }

          // Validate routing number (9 digits)
          if (!/^\d{9}$/.test(bankRoutingNumber)) {
            return NextResponse.json(
              { error: 'Routing number must be 9 digits' },
              { status: 400 }
            );
          }

          // Validate account number (4-17 digits)
          if (!/^\d{4,17}$/.test(bankAccountNumber)) {
            return NextResponse.json(
              { error: 'Account number must be 4-17 digits' },
              { status: 400 }
            );
          }

          updateData.bankName = bankName;
          updateData.bankAccountLast4 = bankAccountNumber.slice(-4);

          // Encrypt sensitive data
          try {
            updateData.bankAccountEncrypted = encrypt(bankAccountNumber);
            updateData.bankRoutingEncrypted = encrypt(bankRoutingNumber);
          } catch (encryptError) {
            console.error('Encryption error:', encryptError);
            return NextResponse.json(
              { error: 'Failed to securely store bank details' },
              { status: 500 }
            );
          }
        }

        await prisma.partner.update({
          where: { id: partner.id },
          data: updateData,
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
    }
  } catch (error) {
    logger.apiError('/api/partners/setup', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
